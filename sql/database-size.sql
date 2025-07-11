select table_schema as database_name,
    table_name,
    round(sum((data_length + index_length)) / power(1024, 2), 2) as used_mb,
    round(sum((data_length + index_length + data_free)) /
              power(1024, 2), 2) as allocated_mb
from information_schema.tables
where table_schema = 'yield_sync' -- put your database name here
    and table_type = 'BASE TABLE'
group by table_schema,
         table_name
order by used_mb desc;
