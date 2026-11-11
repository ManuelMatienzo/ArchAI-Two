package com.archai.comun.configuracion;

import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Session infrastructure has its own version history, independent from legacy project migrations. */
@Configuration
public class MigracionesSesiones {

    @Bean
    public FlywayMigrationStrategy migracionesDelProyectoYSesiones() {
        return project -> {
            project.migrate();
            Flyway.configure()
                .dataSource(project.getConfiguration().getDataSource())
                .locations("classpath:db/sesiones")
                .table("flyway_sesiones_schema_history")
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .load()
                .migrate();
        };
    }
}
