package com.archai.modulo.colaboracion.servicio;

import com.fasterxml.jackson.databind.node.ObjectNode;

public record EventoSala(String room, String diagramId, String type, ObjectNode detail) {}
