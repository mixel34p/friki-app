-- Corregir política RLS para connection_requests
-- El problema era que la política "Users can update requests they received" usaba implícitamente
-- la cláusula USING para validar también la fila NUEVA.
-- Al cambiar el estado de 'pending' a 'accepted', la validación fallaba.

DROP POLICY IF EXISTS "Users can update requests they received" ON connection_requests;

CREATE POLICY "Users can update requests they received"
    ON connection_requests FOR UPDATE
    USING (auth.uid() = target_id)
    WITH CHECK (auth.uid() = target_id);
