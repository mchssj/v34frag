# Ladder Individual de Jugadores - Faceit
## Adaptado para repositorio v34frag

## Visión General del Sistema de Rangos

```mermaid
flowchart TB
    subgraph Niveles[Los 10 Niveles de Faceit]
        direction TB
        N1[Nivel 1<br/>100-399 Elo] --> N2[Nivel 2<br/>400-699 Elo]
        N2 --> N3[Nivel 3<br/>700-999 Elo]
        N3 --> N4[Nivel 4<br/>1000-1199 Elo]
        N4 --> N5[Nivel 5<br/>1200-1399 Elo]
        N5 --> N6[Nivel 6<br/>1400-1599 Elo]
        N6 --> N7[Nivel 7<br/>1600-1799 Elo]
        N7 --> N8[Nivel 8<br/>1800-1999 Elo]
        N8 --> N9[Nivel 9<br/>2000-2000 Elo]
        N9 --> N10[Nivel 10<br/>2001+ Elo]
        N10 --> Desafiante[Desafiante<br/>Top 1.000 regional]
    end
    
    style N1 fill:#ffebee,stroke:#c62828,stroke-width:1.5px
    style N2 fill:#ffcdd2,stroke:#c62828,stroke-width:1.5px
    style N3 fill:#ef9a9a,stroke:#c62828,stroke-width:1.5px
    style N4 fill:#e57373,stroke:#c62828,stroke-width:1.5px
    style N5 fill:#ef5350,stroke:#c62828,stroke-width:1.5px
    style N6 fill:#f48fb1,stroke:#8e24aa,stroke-width:1.5px
    style N7 fill:#f06292,stroke:#8e24aa,stroke-width:1.5px
    style N8 fill:#ec407a,stroke:#8e24aa,stroke-width:1.5px
    style N9 fill:#d81b60,stroke:#8e24aa,stroke-width:1.5px
    style N10 fill:#8e24aa,stroke:#4a148c,stroke-width:1.5px
    style Desafiante fill:#6a1b9a,stroke:#4a148c,stroke-width:2px,color:#fff
```

## Proceso de Temporada y Colocación

```mermaid
flowchart LR
    A[Fin de Temporada Anterior] --> B[Reset Suave de Elo]
    B --> C[10 Partidos de Colocación]
    C --> D{Evaluacion de Rendimiento}
    D -->|Excelente 7-10 victorias| E[+2-3 Niveles]
    D -->|Bueno 5-6 victorias| F[+1 Nivel]
    D -->|Promedio 3-4 victorias| G[Mantener Nivel]
    D -->|Bajo 1-2 victorias| H[-1 Nivel]
    D -->|Muy Bajo 0 victorias| I[-2-3 Niveles]
    E --> J[Inicio Nueva Temporada]
    F --> J
    G --> J
    H --> J
    I --> J
    
    style A fill:#f3e5f5,stroke:#6a1b9a,stroke-width:1.5px
    style B fill:#e8f5e8,stroke:#2e7d32,stroke-width:1.5px
    style C fill:#fff3e0,stroke:#ef6c00,stroke-width:1.5px
    style D fill:#ffe0b2,stroke:#ef6c00,stroke-width:1.5px,stroke-dasharray: 3 3
    style E fill:#c8e6c9,stroke:#2e7d32,stroke-width:1.5px
    style F fill:#c8e6c9,stroke:#2e7d32,stroke-width:1.5px
    style G fill:#c8e6c9,stroke:#2e7d32,stroke-width:1.5px
    style H fill:#ffcdd2,stroke:#c62828,stroke-width:1.5px
    style I fill:#ffcdd2,stroke:#c62828,stroke-width:1.5px
    style J fill:#e3f2fd,stroke:#1565c0,stroke-width:1.5px
```

## Dinamica de Subida/Bajada durante la Temporada

```mermaid
stateDiagram-v2
    [*] --> EstadoActual
    state EstadoActual {
        [*] --> Partiendo
        Partiendo --> Ganando: Victoria Obtenida
        Ganando --> RachadeVictorias: 2 Victorias Consecutivas
        RachadeVictorias --> SubiendoNivel: 3ra Victoria Consecutiva
        SubiendoNivel --> Partiendo
        Partiendo --> Perdiente: Derrota Obtenida
        Perdiente --> RachadeDerrotas: 2 Derrotas Consecutivas
        RachadeDerrotas --> BajandoNivel: 3ra Derrota Consecutiva
        BajandoNivel --> Partiendo
    }
    
    style [*] fill:#ffffff,stroke:#999999,stroke-width:0.5px
    style Partiendo fill:#e3f2fd,stroke:#1565c0,stroke-width:1.5px
    style Ganando fill:#c8e6c9,stroke:#2e7d32,stroke-width:1.5px
    style RachadeVictorias fill:#a5d6a7,stroke:#1b5e20,stroke-width:1.5px
    style SubiendoNivel fill:#8bc34a,stroke:#0b8043,stroke-width:2px
    style Perdiente fill:#ffcdd2,stroke:#c62828,stroke-width:1.5px
    style RachadeDerrotas fill:#ef9a9a,stroke:#c62828,stroke-width:1.5px
    style BajandoNivel fill:#f48fb1,stroke:#6a1b9a,stroke-width:2px
```

## Tabla de Referencia de Niveles

| Nivel | Rango Elo | Descripcion | Color Asociado |
|-------|-----------|-------------|----------------|
| 1 | 100-399 | Principiante | #ffebee |
| 2 | 400-699 | Novato | #ffcdd2 |
| 3 | 700-999 | Intermedio Bajo | #ef9a9a |
| 4 | 1000-1199 | Intermedio | #e57373 |
| 5 | 1200-1399 | Intermedio Alto | #ef5350 |
| 6 | 1400-1599 | Avanzado Bajo | #f48fb1 |
| 7 | 1600-1799 | Avanzado | #f06292 |
| 8 | 1800-1999 | Avanzado Alto | #ec407a |
| 9 | 2000-2000 | Elite | #d81b60 |
| 10 | 2001+ | Maestro | #8e24aa |
| Desafiante | Top 1.000 regional | Distinction Elite | #6a1b9a |

## Notas de Implementacion para v34frag

1. **Actualizacion Automatica**: Considera integrar la API de Faceit para obtener niveles en tiempo real
2. **Indicadores Visuales**: Usa los colores de la tabla para indicadores de nivel en tu UI
3. **Actualizacion de Ladder**: Implementa notificaciones cuando los jugadores cambien de nivel
4. **Historial**: Mantén registro de los logros de "Desafiante" para destacados comunitarios
5. **Integracion de Partidas**: Usa el rango de Elo para crear partidas balanceadas en modos personalizados

*Diagrama adaptado para uso en repositorios de gaming como v34frag - Octubre 2026*