import { SelectGroup, SelectItem, SelectLabel } from '@/components/ui/select';
import { BUILTIN_ROLES, activeCustomRoles } from '@/lib/roles';

export default function RoleSelectOptions({ customRoles = [] }) {
  const active = activeCustomRoles(customRoles);

  return (
    <>
      <SelectGroup>
        <SelectLabel>Built-in Roles</SelectLabel>
        {BUILTIN_ROLES.map((role) => (
          <SelectItem key={role.value} value={role.value}>
            {role.label}
          </SelectItem>
        ))}
      </SelectGroup>
      {active.length > 0 && (
        <SelectGroup>
          <SelectLabel>Custom Roles</SelectLabel>
          {active.map((role) => (
            <SelectItem key={role.id} value={String(role.id)}>
              {role.name}
            </SelectItem>
          ))}
        </SelectGroup>
      )}
    </>
  );
}
