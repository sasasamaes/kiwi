import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Screen, Button, Card } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { driversApi } from '../../src/api/drivers';
import { http } from '../../src/api/client';

const api = driversApi(http);
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am–9pm
const FALLBACK_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** UI por horas sueltas → bloques {dayOfWeek, startTime, endTime} (igual que la web). */
function toApiRows(schedule: Record<number, string[]>) {
  const rows: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  }> = [];
  for (const [dayKey, slots] of Object.entries(schedule)) {
    const day = Number(dayKey);
    const hs = [...new Set((slots || []).map((s) => parseInt(s, 10)))]
      .filter((h) => Number.isInteger(h) && h >= 0 && h < 24)
      .sort((a, b) => a - b);
    let start: number | null = null;
    let prev = -2;
    const flush = (endExclusive: number) => {
      if (start == null) return;
      const d = new Date(Date.UTC(2026, 0, 4 + day));
      // El servidor lee los bloques en hora CR (UTC-6 fijo, sin horario de
      // verano): se guarda la hora CR expresada en UTC. Sin el +6, todo el
      // horario quedaba 6 h corrido y el cron desconectaba en pleno turno.
      const iso = (h: number) =>
        new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h + 6),
        ).toISOString();
      rows.push({
        dayOfWeek: day,
        startTime: iso(start),
        endTime: iso(endExclusive),
        isAvailable: true,
      });
      start = null;
    };
    for (const h of hs) {
      if (start == null || h !== prev + 1) {
        flush(prev + 1);
        start = h;
      }
      prev = h;
    }
    flush(prev + 1);
  }
  return rows;
}

function fromApiRows(rows: any[]): Record<number, string[]> {
  const next: Record<number, string[]> = {};
  for (const r of rows || []) {
    const day = Number(r?.dayOfWeek);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (r?.isAvailable === false) continue;
    const s = new Date(r?.startTime);
    const e = new Date(r?.endTime);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) continue;
    // Inverso del +6 al guardar: la hora CR es UTC menos 6.
    const crH = (d: Date) => (d.getUTCHours() - 6 + 24) % 24;
    const sh = crH(s);
    const ehRaw = crH(e) + (e.getUTCMinutes() > 0 || e.getUTCSeconds() > 0 ? 1 : 0);
    // Rango que cruza medianoche (heredado o slot 23): llega hasta las 24.
    const eh = ehRaw <= sh ? 24 : ehRaw;
    for (let h = sh; h < eh && h < 24; h++) {
      const slot = `${String(h).padStart(2, '0')}:00`;
      next[day] = [...(next[day] || []), slot];
    }
  }
  for (const k of Object.keys(next)) next[Number(k)] = [...new Set(next[Number(k)])].sort();
  return next;
}

export default function Schedule() {
  const { t } = useTranslation();
  const days: string[] = (t as any).driverHours?.days ?? FALLBACK_DAYS;
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [schedule, setSchedule] = useState<Record<number, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.schedule();
        if (!cancelled && Array.isArray(rows)) setSchedule(fromApiRows(rows));
      } catch {
        // Sin red: grilla vacía.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (h: number) => {
    const slot = `${String(h).padStart(2, '0')}:00`;
    setSchedule((prev) => {
      const cur = prev[selectedDay] ?? [];
      return {
        ...prev,
        [selectedDay]: cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot].sort(),
      };
    });
    setSaved(false);
  };

  const selectAllDay = () => {
    setSchedule((prev) => ({
      ...prev,
      [selectedDay]: HOURS.map((h) => `${String(h).padStart(2, '0')}:00`),
    }));
    setSaved(false);
  };

  const clearDay = () => {
    setSchedule((prev) => {
      const next = { ...prev };
      delete next[selectedDay];
      return next;
    });
    setSaved(false);
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api.updateSchedule(toApiRows(schedule));
      setSaved(true);
    } catch (e: any) {
      Alert.alert(t.driverHours.saveFailed, e?.message ?? '');
    } finally {
      setSaving(false);
    }
  }, [schedule, t]);

  const slots = schedule[selectedDay] ?? [];

  return (
    <Screen>
      <Text className="mb-1 text-lg font-bold text-surface-800 dark:text-surface-100">
        {t.driverHours.title}
      </Text>
      <Text className="mb-3 text-xs text-surface-500 dark:text-surface-400">
        {t.driverHours.hint}
      </Text>
      <View className="mb-3 flex-row gap-1.5">
        {days.map((d, i) => (
          <Pressable
            key={d}
            onPress={() => setSelectedDay(i)}
            className={`flex-1 items-center rounded-lg py-2.5 ${
              selectedDay === i ? 'bg-kiwi-700' : 'bg-white dark:bg-surface-800'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                selectedDay === i ? 'text-white' : 'text-surface-800 dark:text-surface-100'
              }`}
            >
              {d}
            </Text>
          </Pressable>
        ))}
      </View>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {HOURS.map((h) => {
          const slot = `${String(h).padStart(2, '0')}:00`;
          const on = slots.includes(slot);
          const label = h <= 12 ? `${h}am` : `${h - 12}pm`;
          return (
            <Pressable
              key={h}
              onPress={() => toggle(h)}
              className={`items-center rounded-lg py-3 ${
                on ? 'bg-kiwi-700' : 'bg-white dark:bg-surface-800'
              }`}
              style={{ width: '31%' }}
            >
              <Text
                className={`font-semibold ${on ? 'text-white' : 'text-surface-800 dark:text-surface-100'}`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="mb-2 flex-row gap-2">
        <View className="flex-1">
          <Button label={t.driverHours.selectAll} variant="secondary" onPress={selectAllDay} />
        </View>
        <View className="flex-1">
          <Button label={t.driverHours.clear} variant="secondary" onPress={clearDay} />
        </View>
      </View>
      <View className="mb-3">
        <Card>
          <Text className="text-xs text-surface-500 dark:text-surface-400">
            💡 {t.driverHours.tip}
          </Text>
        </Card>
      </View>
      <Button
        label={saving ? t.driverHours.saving : saved ? t.driverHours.saved : t.driverHours.save}
        onPress={() => void save()}
      />
      <View className="h-6" />
    </Screen>
  );
}
