alter table payment_events
    add column processing_error boolean not null default false;
