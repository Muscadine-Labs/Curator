import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AddressBadge } from './AddressBadge';
import { ExternalLink } from 'lucide-react';
import { protocolConfig } from '@/lib/config/vaults';

export function RoleList() {
  const { roles } = protocolConfig;

  const roleItems = [
    {
      name: 'Owner',
      address: roles.owner,
      description: 'Safe multisig with protocol ownership',
      safeUrl: `https://app.safe.global/home?safe=base:${roles.owner}`,
    },
    {
      name: 'Guardian',
      address: roles.guardian,
      description: 'Safe multisig with guardian privileges',
      safeUrl: `https://app.safe.global/home?safe=base:${roles.guardian}`,
    },
    {
      name: 'Curator',
      address: roles.curator,
      description: 'Safe multisig with curator privileges',
      safeUrl: `https://app.safe.global/home?safe=base:${roles.curator}`,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {roleItems.map((role) => (
          <div key={role.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{role.name}</Badge>
                <AddressBadge 
                  address={role.address} 
                  scanUrl={`https://basescan.org/address/${role.address}`}
                />
              </div>
              <a
                href={role.safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                Safe <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground">{role.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
