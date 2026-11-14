import { Coffee, Pizza, Utensils, CupSoda, Sandwich } from 'lucide-react';

interface Props {
  category?: string;
  className?: string;
  iconSize?: number;
}

export default function ProductPlaceholder({ category = 'All', className = "", iconSize = 48 }: Props) {
  const getIcon = () => {
    const c = category.toLowerCase();
    if (c.includes('kopi') || c.includes('minum') || c.includes('drink')) return <Coffee size={iconSize} strokeWidth={1.75} />;
    if (c.includes('makan') || c.includes('food')) return <Utensils size={iconSize} strokeWidth={1.75} />;
    if (c.includes('snack') || c.includes('cemilan')) return <Pizza size={iconSize} strokeWidth={1.75} />;
    if (c.includes('soda') || c.includes('jus')) return <CupSoda size={iconSize} strokeWidth={1.75} />;
    if (c.includes('roti') || c.includes('sandwich')) return <Sandwich size={iconSize} strokeWidth={1.75} />;
    return <Coffee size={iconSize} strokeWidth={1.75} />;
  };

  return (
    <div
      aria-hidden="true"
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-[#F6F2EE] text-[#B9A99B] ${className}`}
    >
      <div className="transition-transform duration-300 group-hover:scale-105">
        {getIcon()}
      </div>
    </div>
  );
}
