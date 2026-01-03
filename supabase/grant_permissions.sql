-- Asegurar permisos de ejecución para las funciones
GRANT EXECUTE ON FUNCTION get_poll_results(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_reaction_counts(text, uuid) TO anon, authenticated, service_role;

-- Verificar schema
COMMENT ON FUNCTION get_poll_results IS 'Obtiene resultados agregados de una votación';
COMMENT ON FUNCTION get_reaction_counts IS 'Obtiene conteo de reacciones';

-- Recargar el cache de esquema de Supabase (a veces necesario)
NOTIFY pgrst, 'reload schema';
