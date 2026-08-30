"use client";

import { Tooltip } from "recharts";

import { cursor } from "@/lib/theme/chart";

/**
 * Tooltip Recharts alinhado ao design system: superficie, sombra pop e cursor
 * discreto (--chart-cursor) para nao confundir com o preenchimento da barra.
 */
export default function ThemedTooltip(props: Record<string, unknown>) {
  const { contentStyle, itemStyle, labelStyle, ...rest } = props;
  return (
    <Tooltip
      {...rest}
      cursor={(rest.cursor as object | undefined) ?? cursor}
      contentStyle={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        color: "var(--ink)",
        boxShadow: "var(--shadow-pop)",
        ...(typeof contentStyle === "object" && contentStyle !== null ? contentStyle : {}),
      }}
      itemStyle={{
        color: "var(--ink)",
        ...(typeof itemStyle === "object" && itemStyle !== null ? itemStyle : {}),
      }}
      labelStyle={{
        color: "var(--ink)",
        fontWeight: 600,
        ...(typeof labelStyle === "object" && labelStyle !== null ? labelStyle : {}),
      }}
    />
  );
}
