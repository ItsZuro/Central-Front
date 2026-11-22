import { Badge, Button, Checkbox, Group, Paper, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";

export const WEEK_DAYS = [
  { value: "MONDAY", label: "Lunes" },
  { value: "TUESDAY", label: "Martes" },
  { value: "WEDNESDAY", label: "Miércoles" },
  { value: "THURSDAY", label: "Jueves" },
  { value: "FRIDAY", label: "Viernes" },
  { value: "SATURDAY", label: "Sábado" },
  { value: "SUNDAY", label: "Domingo" },
] as const;

export type DayCode = (typeof WEEK_DAYS)[number]["value"];

export type WeeklyDay = {
  dayOfWeek: DayCode;
  enabled: boolean;
  startTime: string;
  endTime: string;
};

export type StaffShift = {
  dayOfWeek: DayCode;
  startTime: string;
  endTime: string;
};

export function initialWeek(): WeeklyDay[] {
  // Requerimos que el administrador seleccione explícitamente los días.
  return WEEK_DAYS.map((day) => ({
    dayOfWeek: day.value,
    enabled: false,
    startTime: "12:00",
    endTime: "23:59",
  }));
}

export function fromShifts(shifts: StaffShift[]): WeeklyDay[] {
  return WEEK_DAYS.map((day) => {
    const found = shifts.find((shift) => shift.dayOfWeek === day.value);
    return {
      dayOfWeek: day.value,
      enabled: !!found,
      startTime: found?.startTime.slice(0, 5) || "12:00",
      endTime: found?.endTime.slice(0, 5) || "23:59",
    };
  });
}

export function toShifts(week: WeeklyDay[]): StaffShift[] {
  return week.filter((day) => day.enabled).map(({ dayOfWeek, startTime, endTime }) => ({
    dayOfWeek, startTime, endTime,
  }));
}

export function validateWeek(week: WeeklyDay[]): string | null {
  const selected = week.filter((day) => day.enabled);
  if (selected.length === 0) return "Selecciona al menos un día laboral.";
  for (const shift of selected) {
    if (!/^\d{2}:\d{2}$/.test(shift.startTime) || !/^\d{2}:\d{2}$/.test(shift.endTime)) {
      return "Completa una hora de entrada y salida válida en cada día seleccionado.";
    }
    if (shift.startTime >= shift.endTime) {
      const name = WEEK_DAYS.find((day) => day.value === shift.dayOfWeek)?.label || shift.dayOfWeek;
      return "La hora de salida debe ser posterior a la entrada: " + name + ".";
    }
  }
  return null;
}

type Props = {
  value: WeeklyDay[];
  onChange: (value: WeeklyDay[]) => void;
  disabled?: boolean;
};

export default function WeeklyScheduleEditor({ value, onChange, disabled = false }: Props) {
  const setDay = (dayOfWeek: DayCode, patch: Partial<WeeklyDay>) => {
    onChange(value.map((day) => day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day));
  };

  const selectDays = (selected: DayCode[]) => {
    onChange(value.map((day) => ({ ...day, enabled: selected.includes(day.dayOfWeek) })));
  };

  const activeCount = value.filter((day) => day.enabled).length;

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="wrap">
        <div>
          <Text fw={700} size="sm">Horario laboral (Perú)</Text>
          <Text c="dimmed" size="xs">Zona horaria America/Lima (UTC−5). Los días desmarcados son de descanso.</Text>
        </div>
        <Badge color={activeCount ? "red" : "gray"} variant="light">{activeCount} días</Badge>
      </Group>
      <Group gap="xs">
        <Button type="button" size="compact-xs" color="gray" variant="light" disabled={disabled}
          onClick={() => selectDays(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"])}>
          Lunes a viernes
        </Button>
        <Button type="button" size="compact-xs" color="gray" variant="light" disabled={disabled}
          onClick={() => selectDays(WEEK_DAYS.map((day) => day.value))}>
          Todos los días
        </Button>
        <Button type="button" size="compact-xs" color="gray" variant="subtle" disabled={disabled}
          onClick={() => selectDays([])}>
          Limpiar
        </Button>
      </Group>
      <Stack gap="xs">
        {WEEK_DAYS.map(({ value: code, label }) => {
          const day = value.find((entry) => entry.dayOfWeek === code);
          if (!day) return null;
          return (
            <Paper key={code} p="xs" radius="md" withBorder bg={day.enabled ? "red.0" : "gray.0"}>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs" verticalSpacing="xs">
                <Group align="center">
                  <Checkbox color="red" label={label} checked={day.enabled} disabled={disabled}
                    onChange={(event) => setDay(code, { enabled: event.currentTarget.checked })}/>
                </Group>
                <TextInput label="Entrada" type="time" required={day.enabled}
                  value={day.startTime} disabled={disabled || !day.enabled}
                  onChange={(event) => setDay(code, { startTime: event.currentTarget.value })}/>
                <TextInput label="Salida" type="time" required={day.enabled}
                  value={day.endTime} disabled={disabled || !day.enabled}
                  onChange={(event) => setDay(code, { endTime: event.currentTarget.value })}/>
              </SimpleGrid>
            </Paper>
          );
        })}
      </Stack>
      <Text size="xs" c="dimmed">Por ahora se admite un turno por día que no cruce medianoche. La validación de acceso respeta este horario.</Text>
    </Stack>
  );
}
