create policy agents_self_insert on agents
    for insert to authenticated
    with check (id = auth.uid() and coalesce(is_admin, false) = false);
