import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AddressBadge } from './AddressBadge';
import { protocolConfig } from '@/lib/config/vaults';

export function AllocatorList() {
  const { allocators } = protocolConfig.roles;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocators</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {allocators.map((allocator, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge 
                variant={allocator.type === 'public' ? 'default' : 'secondary'}
                className={
                  allocator.type === 'public' 
                    ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' 
                    : ''
                }
              >
                {allocator.type}
              </Badge>
              <span className="font-medium">{allocator.name}</span>
            </div>
            {allocator.address !== '0x0000000000000000000000000000000000000000' && (
              <AddressBadge 
                address={allocator.address} 
                scanUrl={`https://basescan.org/address/${allocator.address}`}
              />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
