-- Lets each signed-in user remove only their own orphaned activity notifications.
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;

CREATE POLICY "Users can delete their notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);
