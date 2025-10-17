import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink } from 'lucide-react';
import { formatAddress } from '@/lib/format/number';

interface AddressBadgeProps {
  address: string;
  scanUrl?: string;
  showCopy?: boolean;
  className?: string;
}

export function AddressBadge({ 
  address, 
  scanUrl, 
  showCopy = true, 
  className 
}: AddressBadgeProps) {

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant="secondary" className="font-mono text-xs">
        {formatAddress(address)}
      </Badge>
      
      {showCopy && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 w-6 p-0"
        >
          <Copy className="h-3 w-3" />
        </Button>
      )}
      
      {scanUrl && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(scanUrl, '_blank')}
          className="h-6 w-6 p-0"
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
