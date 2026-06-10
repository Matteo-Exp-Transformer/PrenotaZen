import React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  icon?: string
  summary?: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  summary,
  isExpanded,
  onToggle,
  children
}) => {
  return (
    <div className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          {icon && <span className="text-xl">{icon}</span>}
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {summary && !isExpanded && (
              <div className="text-sm text-gray-600 mt-1">{summary}</div>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>
      {isExpanded && (
        <div className="pt-3">
          {children}
        </div>
      )}
    </div>
  )
}
