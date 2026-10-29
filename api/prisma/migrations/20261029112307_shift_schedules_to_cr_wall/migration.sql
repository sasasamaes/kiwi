-- Los clientes guardaban la hora CR como si fuera UTC (Date.UTC con la hora
-- del slot); el servidor lee los bloques en hora CR (UTC-6 fijo). Todo lo
-- guardado hasta hoy está 6 h corrido: se alinea una sola vez. Los clientes
-- nuevos ya mandan la hora CR expresada en UTC.
UPDATE "driver_schedules"
SET "start_time" = "start_time" + INTERVAL '6 hours',
    "end_time" = "end_time" + INTERVAL '6 hours';
