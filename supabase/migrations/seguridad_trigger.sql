-- Trigger: crear usuarios_perfil automáticamente al registrar un usuario en auth.users
CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.usuarios_perfil (id, nombre, email, id_tipo_usuario)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    '00000000-0000-0000-0001-000000000003'  -- Cliente por defecto; Admin lo cambia después
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_on_signup();

-- Si el usuario admin ya fue creado antes de la migración, insertar su perfil ahora
DO $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = 'admin@dairypro.com' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.usuarios_perfil (id, nombre, email, id_tipo_usuario)
    VALUES (v_id, 'Administrador', 'admin@dairypro.com', '00000000-0000-0000-0001-000000000001')
    ON CONFLICT (id) DO UPDATE SET id_tipo_usuario = '00000000-0000-0000-0001-000000000001';
  END IF;
END;
$$;
