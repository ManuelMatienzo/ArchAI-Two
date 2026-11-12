package com.archai.comun.configuracion;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class ConfiguracionWebSocket implements WebSocketMessageBrokerConfigurer {

    @org.springframework.beans.factory.annotation.Autowired
    private com.archai.comun.seguridad.ServicioJwt jwt;

    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.beans.factory.ObjectProvider<com.archai.modulo.colaboracion.servicio.ServicioRevisionPropuesta> reviews;

    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.beans.factory.ObjectProvider<com.archai.modulo.colaboracion.servicio.ServicioSalaColaborativa> rooms;

    @Override
    public void configureClientInboundChannel(
        org.springframework.messaging.simp.config.ChannelRegistration registration
    ) {
        registration.interceptors(
            new org.springframework.messaging.support.ChannelInterceptor() {
                @Override
                public org.springframework.messaging.Message<?> preSend(
                    org.springframework.messaging.Message<?> message,
                    org.springframework.messaging.MessageChannel channel
                ) {
                    var accessor = org.springframework.messaging.support.MessageHeaderAccessor.getAccessor(
                        message,
                        org.springframework.messaging.simp.stomp.StompHeaderAccessor.class
                    );
                    if (
                        accessor != null &&
                        org.springframework.messaging.simp.stomp.StompCommand.CONNECT.equals(accessor.getCommand())
                    ) {
                        String auth = accessor.getFirstNativeHeader("Authorization");
                        if (auth == null || !auth.startsWith("Bearer ")) throw new IllegalArgumentException(
                            "Inicia sesión para entrar a la sala."
                        );
                        if (auth != null && auth.startsWith("Bearer ")) {
                            var claims = jwt
                                .validarToken(auth.substring(7))
                                .orElseThrow(() ->
                                    new IllegalArgumentException("Sesión expirada. Inicia sesión nuevamente.")
                                );
                            String id = String.valueOf(claims.get("sub"));
                            accessor.setUser(() -> id);
                        }
                    }
                    if (
                        accessor != null &&
                        (org.springframework.messaging.simp.stomp.StompCommand.SUBSCRIBE.equals(
                            accessor.getCommand()
                        ) ||
                            org.springframework.messaging.simp.stomp.StompCommand.SEND.equals(accessor.getCommand()))
                    ) {
                        var user = accessor.getUser();
                        if (user == null) throw new IllegalArgumentException("Inicia sesión para continuar.");
                        String destination = accessor.getDestination();
                        String room = null;
                        if (destination != null && destination.startsWith("/topic/collab/")) room =
                            destination.substring("/topic/collab/".length());
                        else if (destination != null && destination.startsWith("/app/collab/")) room =
                            destination.substring("/app/collab/".length());
                        else if (destination != null && destination.startsWith("/topic/room/")) room = destination
                            .substring("/topic/room/".length())
                            .split("/")[0];
                        if (room == null || room.isBlank()) throw new IllegalArgumentException("Canal no permitido.");
                        String usuario = user.getName();
                        boolean participante = rooms.getObject().esParticipante(room, usuario);
                        if (!participante) {
                            String diagram = rooms.getObject().diagramaId(room);
                            if (diagram != null) {
                                try {
                                    reviews.getObject().autorizarLecturaUsuario(room, diagram, usuario);
                                } catch (RuntimeException ex) {
                                    throw new IllegalArgumentException("No tienes acceso a esta sala.");
                                }
                            } else throw new IllegalArgumentException("No tienes acceso a esta sala.");
                        }
                    }
                    return message;
                }
            }
        );
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setPreservePublishOrder(true);
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws", "/ws-collab", "/ws-colaboracion").setAllowedOriginPatterns("*").withSockJS();
        // CU-03 · Endpoint STOMP nativo (WebSocket plano) para clientes ligeros
        registry.addEndpoint("/ws-stomp").setAllowedOriginPatterns("*");
    }
}
