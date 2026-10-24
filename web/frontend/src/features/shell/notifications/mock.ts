import { subMinutes } from "date-fns"

import type { Notification } from "./model"

// Datos de ejemplo para desarrollar la UI. Solo se usan con import.meta.env.DEV.
export function mockNotifications(now = new Date()): Notification[] {
  const ago = (minutes: number) => subMinutes(now, minutes).toISOString()
  return [
    {
      id: "n1",
      kind: "invite",
      title: "Invitación a Furia Sur",
      body: "Kova te invitó a unirte al plantel.",
      createdAt: ago(5),
      read: false,
      invite: {
        team: "Furia Sur",
        from: "Kova",
        message: "Buscamos un AWPer para la Liga Apertura.",
      },
    },
    {
      id: "n2",
      kind: "pcw",
      title: "Solicitud de PCW",
      body: "Los Pibes quieren jugar hoy a las 22:15 (BO3).",
      createdAt: ago(32),
      read: false,
      path: "/pcw",
    },
    {
      id: "n3",
      kind: "veto",
      title: "Te toca vetar",
      body: "Furia Sur vs Los Pibes: banea un mapa.",
      createdAt: ago(48),
      read: false,
      path: "/matches",
    },
    {
      id: "n4",
      kind: "elo",
      title: "Subiste a nivel 8",
      body: "+28 ELO en el último mix.",
      createdAt: ago(60 * 3),
      read: true,
      path: "/ranking",
    },
    {
      id: "n5",
      kind: "medal",
      title: "Nueva medalla",
      body: "MVP de la semana.",
      createdAt: ago(60 * 26),
      read: true,
      path: "/hall-of-fame",
    },
    {
      id: "n6",
      kind: "roster",
      title: "Cambio en el plantel",
      body: "Lince se unió a Furia Sur.",
      createdAt: ago(60 * 24 * 3),
      read: true,
      path: "/myteam",
    },
  ]
}
