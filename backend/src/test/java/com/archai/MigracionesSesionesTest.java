package com.archai;

import static org.junit.jupiter.api.Assertions.*;

import com.archai.comun.configuracion.MigracionesSesiones;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class MigracionesSesionesTest {

    @Test
    void conservaV3ExternaYActualizaColaEnHistorialIndependiente() {
        var datasource = new DriverManagerDataSource(
            "jdbc:h2:mem:migration_" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1",
            "sa",
            ""
        );
        var project = Flyway.configure().dataSource(datasource).locations("classpath:db/migration").load();
        project.migrate();
        var jdbc = new JdbcTemplate(datasource);
        jdbc.update(
            "INSERT INTO \"flyway_schema_history\" (\"installed_rank\",\"version\",\"description\",\"type\",\"script\",\"checksum\",\"installed_by\",\"execution_time\",\"success\") VALUES (3,'3','CU23 suscripciones push','SQL','V3__CU23_suscripciones_push.sql',1599809248,'sa',0,TRUE)"
        );
        var strategy = new MigracionesSesiones().migracionesDelProyectoYSesiones();
        strategy.migrate(project);
        strategy.migrate(project);
        assertEquals(
            1599809248,
            jdbc.queryForObject(
                "SELECT \"checksum\" FROM \"flyway_schema_history\" WHERE \"version\"='3'",
                Integer.class
            )
        );
        assertEquals(
            1,
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM \"flyway_sesiones_schema_history\" WHERE \"version\"='1' AND \"success\"=TRUE",
                Integer.class
            )
        );
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM operaciones_documentales", Integer.class));
    }
}
