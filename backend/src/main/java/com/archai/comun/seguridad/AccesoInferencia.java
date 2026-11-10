package com.archai.comun.seguridad;

import jakarta.servlet.http.*;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.*;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class AccesoInferencia implements WebMvcConfigurer {

  private final AccesoProyecto acceso;

  public AccesoInferencia(AccesoProyecto acceso) {
    this.acceso = acceso;
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry
      .addInterceptor(
        new HandlerInterceptor() {
          @Override
          public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler
          ) {
            if (!request.getMethod().equals("OPTIONS")) acceso.usuario(
              request.getHeader("Authorization")
            );
            return true;
          }
        }
      )
      .addPathPatterns(
        "/api/v1/ia/**",
        "/api/v1/ai/**",
        "/api/v1/generator/**",
        "/api/v1/generador/**"
      );
  }
}
