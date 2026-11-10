package com.archai.modulo.colaboracion.servicio;

import com.archai.modulo.autenticacion.dto.PerfilUsuarioDto;
import com.archai.modulo.autenticacion.repositorio.UsuarioRepository;
import com.archai.modulo.colaboracion.dto.MensajeColaboracionDto;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.*;

/** Transport-owned presence: closing one tab does not disconnect another tab or Android. */
@Service
@RequiredArgsConstructor
public class ServicioPresenciaSala {

    private final ServicioSalaColaborativa rooms;
    private final ServicioConversacion chat;
    private final UsuarioRepository users;
    private final SimpMessagingTemplate broker;

    private record Link(String room, String user) {}

    private final Map<String, Map<String, Link>> subscriptions = new HashMap<>();

    @EventListener
    public synchronized void subscribed(SessionSubscribeEvent event) {
        var headers = StompHeaderAccessor.wrap(event.getMessage());
        String destination = headers.getDestination();
        if (destination == null || !destination.startsWith("/topic/collab/") || event.getUser() == null) return;
        String room = destination.substring("/topic/collab/".length()),
            session = headers.getSessionId(),
            subscription = headers.getSubscriptionId(),
            user = event.getUser().getName();
        if (session == null || subscription == null) return;
        var existing = subscriptions.computeIfAbsent(session, k -> new HashMap<>());
        boolean already = existing
            .values()
            .stream()
            .anyMatch(l -> l.room.equals(room));
        existing.put(subscription, new Link(room, user));
        if (already) return;
        rooms.conectarTransporte(room, session, user);
        users.findById(user).ifPresent(profile -> {
            var member = PerfilUsuarioDto.builder()
                .id(user)
                .name(profile.getNombre())
                .email(profile.getCorreo())
                .role(profile.getRol())
                .avatarColor(profile.getColorAvatar())
                .build();
            rooms.unirseSala(room, member);
            broadcast(room, "join", user);
        });
    }

    @EventListener
    public synchronized void unsubscribed(SessionUnsubscribeEvent event) {
        var headers = StompHeaderAccessor.wrap(event.getMessage());
        var links = subscriptions.get(headers.getSessionId());
        if (links == null) return;
        Link removed = links.remove(headers.getSubscriptionId());
        if (
            removed != null &&
            links
                .values()
                .stream()
                .noneMatch(l -> l.room.equals(removed.room))
        ) leave(headers.getSessionId(), removed);
        if (links.isEmpty()) subscriptions.remove(headers.getSessionId());
    }

    @EventListener
    public synchronized void disconnected(SessionDisconnectEvent event) {
        var links = subscriptions.remove(event.getSessionId());
        if (links == null) return;
        new HashSet<>(links.values()).forEach(link -> leave(event.getSessionId(), link));
    }

    private void leave(String session, Link link) {
        rooms.desconectarTransporte(link.room, session);
        if (!rooms.estaConectado(link.room, link.user)) {
            rooms.salirDeSala(link.room, link.user);
            broadcast(link.room, "leave", link.user);
        }
        if (!rooms.hayConexiones(link.room)) chat.suspenderObservacion(link.room);
    }

    private void broadcast(String room, String type, String user) {
        var participants = rooms.listarParticipantes(room);
        broker.convertAndSend("/topic/room/" + room + "/presence", participants);
        var member = participants
            .stream()
            .filter(p -> user.equals(p.getId()))
            .findFirst()
            .orElseGet(() -> PerfilUsuarioDto.builder().id(user).name("Colaborador").build());
        broker.convertAndSend(
            "/topic/collab/" + room,
            MensajeColaboracionDto.builder()
                .tipo(type)
                .salaId(room)
                .emisorId(user)
                .emisorNombre(member.getName())
                .timestamp(System.currentTimeMillis())
                .payload(Map.of("usuario", member, "usuarioId", user, "participantes", participants))
                .build()
        );
    }
}
