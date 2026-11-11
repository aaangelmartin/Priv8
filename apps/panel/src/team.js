/* Las personas de los datos de ejemplo de la web: el equipo. El dominio de los correos está aquí, en un solo sitio,
   para cambiarlo cuando se decida cuál se registra. */
export const MAIL_DOMAIN = 'priv8.es';
export const TEAM = [
  { name: 'Ángel Martín', user: 'angel' },
  { name: 'Álvaro Carpintero', user: 'alvaro' },
  { name: 'Pablo Rojo', user: 'pablo' },
  { name: 'Marco Barroso', user: 'marco' },
];
export const mail = (user) => `${user}@${MAIL_DOMAIN}`;
