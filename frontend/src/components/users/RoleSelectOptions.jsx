import { SelectGroup, SelectItem, SelectLabel } from '@/components/ui/select';
import { activeRoles } from '@/lib/roles';

export default function RoleSelectOptions({ roles = [] }) {
  const active = activeRoles(roles);

  return (
    <SelectGroup>
      <SelectLabel>Roles</SelectLabel>
      {active.map((role) => (
        <SelectItem key={role.id} value={String(role.id)}>
          {role.name}
          {role.is_system ? '' : ''}
        </SelectItem>
      ))}
    </SelectGroup>
  );
}
