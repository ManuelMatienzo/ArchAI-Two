package com.archai.comun.configuracion;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * CU-23 — Pool dedicado para despachar alertas push sin bloquear los hilos de STOMP.
 */
@Configuration
@EnableAsync
public class ConfiguracionAsync {

    @Bean(name = "pushTaskExecutor")
    public Executor pushTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("archai-push-");
        executor.initialize();
        return executor;
    }
}
