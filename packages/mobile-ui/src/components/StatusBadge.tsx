import { Text, View } from 'react-native';
import { tokens } from '../theme';

const LABELS: Record<string, string> = {
  pending: 'Pendiente',
  assigned: 'Asignado',
  in_transit_to_pickup: 'En camino a retiro',
  picked_up: 'Retirado',
  in_transit_to_delivery: 'En camino a entrega',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  no_driver: 'Sin repartidor',
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.surface,
        borderRadius: tokens.radius.sm,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: tokens.color.lime, fontSize: 12, fontWeight: '600' }}>
        {LABELS[status] ?? status}
      </Text>
    </View>
  );
}
