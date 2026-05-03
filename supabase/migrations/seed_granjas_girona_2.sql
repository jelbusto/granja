-- Seed: 20 granjas lecheras adicionales de Girona
-- Comarques: Alt Empordà, Baix Empordà, La Selva, Osona (límit), Ripollès, Gironès

INSERT INTO granjas (
  codigo, nombre, direccion, poblacion, provincia, pais,
  n_patios_lactacion, preparto, postparto,
  pct_eliminacion, dias_secado, activo, updated_at,
  lat, lon
) VALUES
  ('GIR-021', 'Mas Oliveres',     'Camí de la Garriga, 3',         'Castelló d''Empúries', 'Girona', 'ES', 3, true,  true,  26.0, 60, true, NOW(), 42.2548,  3.0764),
  ('GIR-022', 'Can Bosch',        'Carretera de l''Escala, km 2',  'L''Escala',            'Girona', 'ES', 2, true,  false, 27.5, 58, true, NOW(), 42.1157,  3.1268),
  ('GIR-023', 'Mas Noguer',       'Camí del Molí, 6',              'La Bisbal d''Empordà', 'Girona', 'ES', 4, true,  true,  25.0, 62, true, NOW(), 41.9611,  3.0391),
  ('GIR-024', 'Can Paretas',      'Carretera de Girona, km 5',     'Palamós',              'Girona', 'ES', 3, false, true,  28.0, 60, true, NOW(), 41.8491,  3.1293),
  ('GIR-025', 'Mas Ferrer',       'Camí de les Oliveres, 14',      'Torroella de Montgrí', 'Girona', 'ES', 3, true,  true,  26.5, 60, true, NOW(), 42.0421,  3.1256),
  ('GIR-026', 'Can Geli',         'Carretera de Girona, km 3',     'Santa Coloma de Farners', 'Girona', 'ES', 2, true, false, 29.0, 55, true, NOW(), 41.8643,  2.6584),
  ('GIR-027', 'Mas Cors',         'Camí del Bosc, 9',              'Maçanet de la Selva',  'Girona', 'ES', 3, true,  true,  27.0, 60, true, NOW(), 41.7931,  2.7459),
  ('GIR-028', 'Can Sauleda',      'Camí del Pla, 2',               'Anglès',               'Girona', 'ES', 2, false, true,  28.5, 58, true, NOW(), 41.9547,  2.6314),
  ('GIR-029', 'Mas Llauró',       'Camí de la Serra, 7',           'Arbúcies',             'Girona', 'ES', 2, true,  false, 30.0, 55, true, NOW(), 41.8214,  2.5431),
  ('GIR-030', 'Can Planes',       'Carretera d''Olot, km 6',       'Sant Feliu de Pallerols', 'Girona', 'ES', 3, true, true,  25.5, 63, true, NOW(), 42.0021,  2.5147),
  ('GIR-031', 'Mas Pujol',        'Camí dels Horts, 11',           'Amer',                 'Girona', 'ES', 3, true,  true,  26.0, 60, true, NOW(), 41.9814,  2.5671),
  ('GIR-032', 'Can Trincheria',   'Camí de Sant Miquel, 4',        'Les Planes d''Hostoles','Girona', 'ES', 4, true,  true,  24.5, 65, true, NOW(), 42.0287,  2.5024),
  ('GIR-033', 'Mas Creus',        'Carretera de Ripoll, km 3',     'Sant Joan de les Abadesses','Girona','ES', 2, true, false, 27.5, 58, true, NOW(), 42.2164,  2.3031),
  ('GIR-034', 'Can Esteve',       'Camí del Riu, 8',               'Ribes de Freser',      'Girona', 'ES', 2, false, true,  29.5, 55, true, NOW(), 42.3014,  2.1654),
  ('GIR-035', 'Mas Puigventós',   'Carretera de Figueres, km 2',   'Vilafant',             'Girona', 'ES', 3, true,  true,  26.0, 60, true, NOW(), 42.2812,  2.9732),
  ('GIR-036', 'Can Roure',        'Camí de la Garriga, 5',         'Bàscara',              'Girona', 'ES', 4, true,  true,  25.0, 62, true, NOW(), 42.1713,  2.9073),
  ('GIR-037', 'Mas Coromina',     'Camí del Fluvià, 3',            'Pontós',               'Girona', 'ES', 3, true,  true,  27.0, 60, true, NOW(), 42.1891,  2.9514),
  ('GIR-038', 'Can Miret',        'Carretera de Girona, km 4',     'Sarrià de Ter',        'Girona', 'ES', 2, true,  false, 28.0, 58, true, NOW(), 41.9975,  2.8431),
  ('GIR-039', 'Mas Vendrell',     'Camí de les Comes, 6',          'Quart',                'Girona', 'ES', 3, false, true,  27.5, 60, true, NOW(), 41.9678,  2.8047),
  ('GIR-040', 'Can Llorens',      'Camí del Bosc, 13',             'Medinyà',              'Girona', 'ES', 3, true,  true,  26.5, 62, true, NOW(), 42.0213,  2.8794)

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
