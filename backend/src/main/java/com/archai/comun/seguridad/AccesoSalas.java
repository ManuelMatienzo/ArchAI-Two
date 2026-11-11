package com.archai.comun.seguridad;

import com.archai.modulo.colaboracion.servicio.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.*;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class AccesoSalas implements WebMvcConfigurer {

    private final ObjectProvider<ServicioRevisionPropuesta> reviews;
    private final ObjectProvider<ServicioSalaColaborativa> rooms;

    public AccesoSalas(
        ObjectProvider<ServicioRevisionPropuesta> reviews,
        ObjectProvider<ServicioSalaColaborativa> rooms
    ) {
        this.reviews = reviews;
        this.rooms = rooms;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry
            .addInterceptor(
                new HandlerInterceptor() {
                    @Override
                    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                        if (request.getMethod().equals("OPTIONS")) return true;
                        var service = reviews.getObject();
                        String user = service.usuario(request.getHeader("Authorization"));
                        String[] parts = request.getRequestURI().split("/");
                        if (parts.length > 5 && (parts[4].equals("salas") || parts[4].equals("rooms"))) {
                            String room = parts[5];
                            if (java.util.Set.of("abrir", "unirse", "join").contains(room)) return true;
                            String diagram = rooms.getObject().diagramaId(room);
                            if (diagram != null) service.autorizarLecturaUsuario(room, diagram, user);
                            else if (!rooms.getObject().esParticipante(room, user)) throw new ResponseStatusException(
                                HttpStatus.FORBIDDEN,
                                "No tienes acceso a esta sala."
                            );
                        }
                        return true;
                    }
                }
            )
            .addPathPatterns("/api/v1/colaboracion/**", "/api/v1/collab/**");
    }
}
