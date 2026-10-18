alter table plans
    add column sort_order integer not null default 0;

with ranked as (
    select id, row_number() over (order by price_minor_unit asc, created_at asc) - 1 as rnk
    from plans
)
update plans
set sort_order = ranked.rnk
from ranked
where plans.id = ranked.id;
