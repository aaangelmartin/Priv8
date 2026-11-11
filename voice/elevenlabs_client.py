"""Cloud voice: streaming TTS with the official ElevenLabs Python SDK.

Checked against elevenlabs==2.77.0 (pinned in voice/requirements.txt):

    from elevenlabs.client import ElevenLabs
    client = ElevenLabs(api_key=...)
    client.text_to_speech.stream(voice_id, text=..., model_id=...,
                                 output_format=..., language_code=...)
    -> Iterator[bytes]

Only cloud segments reach this module, and each one passes the final block
again right before the request (defense in depth: the segmenter already
checked it). previous_text / next_text are deliberately not sent: the
neighbouring text is often a local segment, that is, real data.

Configuration comes from the environment (see voice/.env.example). There is
no real key yet: tests inject a fake client and never call the live API.
"""

from __future__ import annotations

import os
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from typing import Any, Protocol

from .leak_check import LeakCheck, PatternLeakCheck
from .segmenter import LeakBlocked, Segment, Utterance

DEFAULT_MODEL_ID = "eleven_flash_v2_5"  # lowest latency; accepts language_code
# Raw 16-bit little-endian mono PCM at 24 kHz: the phone writes it straight
# into an AudioTrack, with no decoder in the way (see apps/android-8/.../voz/MixedVoicePlayer.kt).
DEFAULT_OUTPUT_FORMAT = "pcm_24000"
DEFAULT_LANGUAGE = "es"


class TextToSpeechAPI(Protocol):
    def stream(self, voice_id: str, *, text: str, **kwargs: Any) -> Iterator[bytes]: ...


class ElevenLabsLike(Protocol):
    text_to_speech: TextToSpeechAPI


class MissingConfig(RuntimeError):
    pass


@dataclass(frozen=True)
class CloudVoiceConfig:
    api_key: str
    voice_id: str
    model_id: str = DEFAULT_MODEL_ID
    output_format: str = DEFAULT_OUTPUT_FORMAT
    language_code: str = DEFAULT_LANGUAGE

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> CloudVoiceConfig:
        env = os.environ if env is None else env
        missing = [k for k in ("ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID") if not env.get(k)]
        if missing:
            raise MissingConfig(f"missing environment variables: {', '.join(missing)}")
        return cls(
            api_key=env["ELEVENLABS_API_KEY"],
            voice_id=env["ELEVENLABS_VOICE_ID"],
            model_id=env.get("ELEVENLABS_MODEL_ID") or DEFAULT_MODEL_ID,
            output_format=env.get("ELEVENLABS_OUTPUT_FORMAT") or DEFAULT_OUTPUT_FORMAT,
            language_code=env.get("ELEVENLABS_LANGUAGE") or DEFAULT_LANGUAGE,
        )


class CloudVoice:
    """Streams cloud segments from ElevenLabs, after the final block."""

    def __init__(self, config: CloudVoiceConfig, client: ElevenLabsLike | None = None,
                 leak_check: LeakCheck | None = None):
        self.config = config
        self.leak_check = leak_check if leak_check is not None else PatternLeakCheck()
        if client is None:
            from elevenlabs.client import ElevenLabs  # imported lazily: tests need no SDK

            client = ElevenLabs(api_key=config.api_key)
        self._client = client

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None, **kwargs: Any) -> CloudVoice:
        return cls(CloudVoiceConfig.from_env(env), **kwargs)

    def stream_text(self, text: str) -> Iterator[bytes]:
        """Stream audio for one data-free sentence. Raises LeakBlocked before any request."""
        findings = self.leak_check.check(text)
        if findings:
            raise LeakBlocked(f.kind for f in findings)
        return self._client.text_to_speech.stream(
            self.config.voice_id,
            text=text,
            model_id=self.config.model_id,
            output_format=self.config.output_format,
            language_code=self.config.language_code,
        )

    def stream_segment(self, segment: Segment) -> Iterator[bytes]:
        if segment.voice != "cloud" or not segment.text:
            raise ValueError("only cloud segments with text go to ElevenLabs")
        return self.stream_text(segment.text)

    def stream_utterance(self, utterance: Utterance) -> Iterator[tuple[int, bytes]]:
        """Yield (segment index, audio chunk) for every cloud segment, in order.

        The core forwards these chunks to the phone over the bridge; local
        segments are skipped here because the phone speaks them itself.
        """
        for index, seg in enumerate(utterance.segments):
            if seg.voice != "cloud":
                continue
            for chunk in self.stream_segment(seg):
                if chunk:
                    yield index, chunk
