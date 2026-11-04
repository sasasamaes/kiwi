import { Text, View } from 'react-native';

const DEFAULT_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  awaiting_payment: 'Esperando pago',
  assigned: 'Asignado',
  in_transit_to_pickup: 'En camino a retiro',
  picked_up: 'Retirado',
  in_transit_to_delivery: 'En camino a entrega',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  no_driver: 'Sin repartidor',
};
export function StatusBadge({
  status,
  labels,
}: {
  status: string;
  labels?: Record<string, string>;
}) {
  return (
    <View className="self-start rounded-md bg-kiwi-50 px-2 py-1 dark:bg-kiwi-900/30">
      <Text className="text-xs font-semibold text-kiwi-700 dark:text-kiwi-400">
        {(labels ?? DEFAULT_LABELS)[status] ?? status}
      </Text>
    </View>
  );
}
