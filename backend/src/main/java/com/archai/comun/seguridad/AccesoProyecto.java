package com.archai.comun.seguridad;

import com.archai.modulo.autenticacion.repositorio.UsuarioRepository;
import com.archai.modulo.diagrama.repositorio.DiagramaRepository;
import com.archai.modulo.proyecto.repositorio.*;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AccesoProyecto {

  private final ServicioJwt jwt;
  private final ProyectoRepository projects;
  private final MiembroProyectoRepository members;
  private final DiagramaRepository diagrams;
  private final UsuarioRepository users;

  public String usuario(String auth) {
    String token =
      auth != null && auth.startsWith("Bearer ") ? auth.substring(7) : "";
    String user = String.valueOf(
      jwt
        .validarToken(token)
        .orElseThrow(() ->
          new ResponseStatusException(
            HttpStatus.UNAUTHORIZED,
            "Inicia sesión para continuar."
          )
        )
        .get("sub")
    );
    if (!users.existsById(user)) throw new ResponseStatusException(
      HttpStatus.UNAUTHORIZED,
      "Inicia sesión para continuar."
    );
    return user;
  }

  public void proyecto(String id, String user, boolean edit, boolean admin) {
    var p = projects
      .findById(id)
      .orElseThrow(() ->
        new ResponseStatusException(
          HttpStatus.NOT_FOUND,
          "El proyecto no existe."
        )
      );
    if (
      p.getPropietario() != null && user.equals(p.getPropietario().getId())
    ) return;
    var member = members
      .findByProyectoIdAndUsuarioId(id, user)
      .orElseThrow(() ->
        new ResponseStatusException(
          HttpStatus.FORBIDDEN,
          "No eres miembro de este proyecto."
        )
      );
    String role = member.getRolProyecto();
    if (
      (admin && !Set.of("PROPIETARIO", "ADMINISTRADOR").contains(role)) ||
      (edit && !Set.of("PROPIETARIO", "ADMINISTRADOR", "EDITOR").contains(role))
    ) throw new ResponseStatusException(
      HttpStatus.FORBIDDEN,
      "Tu cuenta no tiene permiso para realizar este cambio."
    );
  }

  public void diagrama(String id, String user, boolean edit) {
    var d = diagrams
      .findForReview(id)
      .orElseThrow(() ->
        new ResponseStatusException(
          HttpStatus.NOT_FOUND,
          "El diagrama no existe."
        )
      );
    if (d.getProyecto() != null) proyecto(
      d.getProyecto().getId(),
      user,
      edit,
      false
    );
    else if (
      d.getCreador() == null || !user.equals(d.getCreador().getId())
    ) throw new ResponseStatusException(
      HttpStatus.FORBIDDEN,
      "No tienes acceso a este diagrama."
    );
  }

  public boolean puedeLeer(String id, String user) {
    try {
      diagrama(id, user, false);
      return true;
    } catch (ResponseStatusException ex) {
      return false;
    }
  }
}
