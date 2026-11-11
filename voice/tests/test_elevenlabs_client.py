"""The live API is never called: a fake client stands in for elevenlabs.client.ElevenLabs."""

import pytest

from voice.elevenlabs_client import (
    DEFAULT_MODEL_ID,
    DEFAULT_OUTPUT_FORMAT,
    CloudVoice,
    CloudVoiceConfig,
    MissingConfig,
)
from voice.leak_check import PatternLeakCheck
from voice.segmenter import LeakBlocked, Segment, VaultRenderer, segment

ENV = {"ELEVENLABS_API_KEY": "test-key", "ELEVENLABS_VOICE_ID": "voice-123"}


class FakeTTS:
    def __init__(self):
        self.calls = []

    def stream(self, voice_id, *, text, **kwargs):
        self.calls.append({"voice_id": voice_id, "text": text, **kwargs})
        yield b"\x00\x01" * 4
        yield b""
        yield b"\x02\x03" * 4


class FakeClient:
    def __init__(self):
        self.text_to_speech = FakeTTS()


@pytest.fixture
def client():
    return FakeClient()


def voice(client, **kw):
    return CloudVoice(CloudVoiceConfig.from_env(ENV), client=client, **kw)


def test_config_from_env_with_defaults():
    cfg = CloudVoiceConfig.from_env(ENV)
    assert cfg.voice_id == "voice-123"
    assert cfg.model_id == DEFAULT_MODEL_ID
    assert cfg.output_format == DEFAULT_OUTPUT_FORMAT
    assert cfg.language_code == "es"


def test_config_requires_key_and_voice():
    with pytest.raises(MissingConfig, match="ELEVENLABS_API_KEY"):
        CloudVoiceConfig.from_env({"ELEVENLABS_VOICE_ID": "v"})
    with pytest.raises(MissingConfig, match="ELEVENLABS_VOICE_ID"):
        CloudVoiceConfig.from_env({"ELEVENLABS_API_KEY": "k"})


def test_stream_text_calls_the_sdk_stream_endpoint(client):
    chunks = list(voice(client).stream_text("Entre tus tres cuentas tienes"))
    assert b"".join(chunks) == b"\x00\x01" * 4 + b"\x02\x03" * 4
    assert client.text_to_speech.calls == [{
        "voice_id": "voice-123",
        "text": "Entre tus tres cuentas tienes",
        "model_id": DEFAULT_MODEL_ID,
        "output_format": DEFAULT_OUTPUT_FORMAT,
        "language_code": "es",
    }]


def test_no_neighbour_context_is_sent(client):
    list(voice(client).stream_text("Voy a pasar"))
    call = client.text_to_speech.calls[0]
    assert "previous_text" not in call and "next_text" not in call


@pytest.mark.parametrize("text", [
    "Tienes 4.873,00 €",
    "Tu IBAN es ES91 2100 0418 4502 0005 1332",
    "Tienes ‹SUMA_1›",
    "Hola Lucía Ferrer",
])
def test_final_block_stops_the_request(client, text):
    cloud = voice(client, leak_check=PatternLeakCheck(known_values=["Lucía Ferrer"]))
    with pytest.raises(LeakBlocked):
        list(cloud.stream_text(text))
    assert client.text_to_speech.calls == []


def test_local_segments_are_refused(client):
    with pytest.raises(ValueError):
        voice(client).stream_segment(Segment("local", text="doscientos euros", token="‹IMPORTE_6›"))


def test_stream_utterance_only_sends_cloud_segments(client):
    vault = {"‹IMPORTE_6›": "200 €", "‹PROVEEDOR_2›": "Nimbo Bróker"}
    check = PatternLeakCheck(known_values=vault.values())
    u = segment("Voy a pasar ‹IMPORTE_6› a tu cuenta de ‹PROVEEDOR_2-propio›. ¿Lo confirmas?",
                VaultRenderer(vault), utterance="u1", session="s1", leak_check=check)
    out = list(voice(client, leak_check=check).stream_utterance(u))
    assert {i for i, _ in out} == {0, 2, 4}
    assert all(chunk for _, chunk in out)
    sent = [c["text"] for c in client.text_to_speech.calls]
    assert sent == ["Voy a pasar", "a tu cuenta de", "¿Lo confirmas?"]
    for text in sent:
        assert "200" not in text and "doscientos" not in text and "Nimbo" not in text
