-- ============================================================
-- KOINOS: Semilla de citas iniciales
-- Migración: 20260413000003_seed_citas.sql
-- Descripción: Citas de figuras históricas y filosóficas
-- ============================================================

insert into citas (text, author, source) values
  ('La felicidad de tu vida depende de la calidad de tus pensamientos.',
   'Marco Aurelio', 'Meditaciones'),

  ('No es que tengamos poco tiempo, sino que perdemos mucho.',
   'Séneca', 'Sobre la brevedad de la vida'),

  ('Solo sé que no sé nada.',
   'Sócrates', 'Apología de Platón'),

  ('Somos lo que hacemos repetidamente. La excelencia, entonces, no es un acto sino un hábito.',
   'Aristóteles', 'Ética a Nicómaco'),

  ('El hombre superior busca lo que es correcto; el hombre inferior busca lo que es rentable.',
   'Confucio', 'Analectas'),

  ('Ser o no ser, esa es la cuestión.',
   'William Shakespeare', 'Hamlet'),

  ('La vida no examinada no vale la pena ser vivida.',
   'Sócrates', 'Apología de Platón'),

  ('Elige un trabajo que ames y no tendrás que trabajar ni un día de tu vida.',
   'Confucio', 'Analectas'),

  ('La verdadera sabiduría está en reconocer la propia ignorancia.',
   'Sócrates', null),

  ('Quien conquista a otros es fuerte; quien se conquista a sí mismo es poderoso.',
   'Lao Tzu', 'Tao Te Ching'),

  ('Nunca encontrarás tiempo para nada. Si quieres tiempo, debes crearlo.',
   'Charles Buxton', null),

  ('Todo lo que escuchamos es una opinión, no un hecho. Todo lo que vemos es una perspectiva, no la verdad.',
   'Marco Aurelio', 'Meditaciones'),

  ('La educación es el arma más poderosa que puedes usar para cambiar el mundo.',
   'Nelson Mandela', null),

  ('No hay camino para la paz, la paz es el camino.',
   'Mahatma Gandhi', null),

  ('El que tiene un porqué para vivir puede soportar casi cualquier cómo.',
   'Friedrich Nietzsche', 'El crepúsculo de los ídolos');
