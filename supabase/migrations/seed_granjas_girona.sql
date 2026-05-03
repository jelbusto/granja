-- Seed: 20 granjas lecheras de Girona
-- Comarcas representadas: La Garrotxa, Pla de l'Estany, Gironès, Ripollès, La Selva, Alt Empordà

INSERT INTO granjas (
  codigo, nombre, direccion, poblacion, provincia, pais,
  n_patios_lactacion, preparto, postparto,
  pct_eliminacion, dias_secado, activo, updated_at,
  lat, lon
) VALUES
  ('GIR-001', 'Can Roca',                 'Camí de la Font, 12',              'Olot',                    'Girona', 'ES', 3, true,  true,  27.0, 60, true, NOW(), 42.1872,  2.4873),
  ('GIR-002', 'Mas Puigdomènech',          'Carretera de Porqueres, km 4',     'Banyoles',                'Girona', 'ES', 4, true,  true,  26.5, 60, true, NOW(), 42.1168,  2.7731),
  ('GIR-003', 'Can Collell',               'Camí de la Moixina, 8',            'Santa Pau',               'Girona', 'ES', 2, true,  false, 28.0, 55, true, NOW(), 42.1472,  2.5677),
  ('GIR-004', 'Mas Vilar',                 'Camí del Mas Vilar, s/n',          'Porqueres',               'Girona', 'ES', 3, true,  true,  25.5, 62, true, NOW(), 42.1318,  2.7513),
  ('GIR-005', 'Can Calsina',               'Carretera de Girona, km 8',        'Riudellots de la Selva',  'Girona', 'ES', 3, true,  true,  29.0, 60, true, NOW(), 41.8963,  2.7782),
  ('GIR-006', 'Mas Surroca',               'Camí dels Prats, 5',               'Ripoll',                  'Girona', 'ES', 2, false, true,  27.5, 58, true, NOW(), 42.2024,  2.1914),
  ('GIR-007', 'Can Batlle',                'Carretera de Banyoles, km 6',      'Cornellà del Terri',      'Girona', 'ES', 4, true,  true,  24.0, 65, true, NOW(), 42.1038,  2.7975),
  ('GIR-008', 'Mas Puig',                  'Camí de la Fageda, 2',             'Castellfollit de la Roca','Girona', 'ES', 2, true,  true,  30.0, 60, true, NOW(), 42.2246,  2.5635),
  ('GIR-009', 'Can Solà',                  'Camí de les Comes, 14',            'Brunyola',                'Girona', 'ES', 2, false, false, 26.0, 55, true, NOW(), 41.8931,  2.7084),
  ('GIR-010', 'Mas Quintana',              'Carretera d''Olot, km 3',          'Sant Joan les Fonts',     'Girona', 'ES', 3, true,  true,  28.5, 60, true, NOW(), 42.1978,  2.5065),
  ('GIR-011', 'Can Masó',                  'Camí del Bosc, 7',                 'Les Preses',              'Girona', 'ES', 3, true,  true,  25.0, 60, true, NOW(), 42.1684,  2.5314),
  ('GIR-012', 'Mas Carrera',               'Camí de la Plana, 19',             'Vilademuls',              'Girona', 'ES', 4, true,  true,  27.0, 62, true, NOW(), 42.0874,  2.8564),
  ('GIR-013', 'Can Coma',                  'Camí de la Font Picant, 3',        'Sant Hilari Sacalm',      'Girona', 'ES', 2, true,  false, 29.5, 58, true, NOW(), 41.8714,  2.5318),
  ('GIR-014', 'Mas Torrent',               'Carretera de Salt, km 2',          'Celrà',                   'Girona', 'ES', 3, true,  true,  26.0, 60, true, NOW(), 41.9897,  2.8432),
  ('GIR-015', 'Can Ginesta',               'Camí de les Feixes, 4',            'La Vall d''en Bas',       'Girona', 'ES', 3, true,  true,  25.5, 63, true, NOW(), 42.1514,  2.4732),
  ('GIR-016', 'Mas Guanter',               'Camí del Molí, 11',                'Navata',                  'Girona', 'ES', 4, true,  true,  26.5, 60, true, NOW(), 42.1592,  2.9135),
  ('GIR-017', 'Can Frigola',               'Carretera de Figueres, km 1',      'Vilafant',                'Girona', 'ES', 2, false, true,  28.0, 60, true, NOW(), 42.2584,  2.9641),
  ('GIR-018', 'Mas Ventura',               'Camí de la Tramuntana, 6',         'Sant Pere Pescador',      'Girona', 'ES', 3, true,  true,  27.5, 58, true, NOW(), 42.1821,  3.0847),
  ('GIR-019', 'Can Pallàs',               'Carretera de Molló, km 5',         'Camprodon',               'Girona', 'ES', 2, true,  false, 30.0, 55, true, NOW(), 42.3141,  2.3681),
  ('GIR-020', 'Mas Pla',                   'Camí del Fluvià, 9',               'Besalú',                  'Girona', 'ES', 3, true,  true,  24.5, 65, true, NOW(), 42.2003,  2.7013)

ON CONFLICT (codigo) DO UPDATE SET
  nombre        = EXCLUDED.nombre,
  direccion     = EXCLUDED.direccion,
  poblacion     = EXCLUDED.poblacion,
  provincia     = EXCLUDED.provincia,
  pais          = EXCLUDED.pais,
  n_patios_lactacion = EXCLUDED.n_patios_lactacion,
  preparto      = EXCLUDED.preparto,
  postparto     = EXCLUDED.postparto,
  pct_eliminacion = EXCLUDED.pct_eliminacion,
  dias_secado   = EXCLUDED.dias_secado,
  activo        = EXCLUDED.activo,
  updated_at    = NOW(),
  lat           = EXCLUDED.lat,
  lon           = EXCLUDED.lon;
