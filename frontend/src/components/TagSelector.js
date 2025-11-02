import React, { useState, useRef, useEffect } from 'react';
import { Tag, X, Search, ChevronDown, Check } from 'lucide-react';

const TagSelector = ({ tags = [], selectedTagIds = [], onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id));
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tag.description && tag.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleTagToggle = (tagId) => {
    if (disabled) return;
    
    const isSelected = selectedTagIds.includes(tagId);
    if (isSelected) {
      onChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleRemoveTag = (tagId, e) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedTagIds.filter(id => id !== tagId));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Tags Display */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
                  className={`min-h-[38px] w-full px-3 py-2 border border-snowflake-300 rounded-md bg-white flex items-center flex-wrap gap-1.5 ${
          disabled ? 'bg-snowflake-50 cursor-not-allowed' : 'cursor-pointer hover:border-snowflake-400'
        } ${isOpen ? 'ring-2 ring-primary-500 border-primary-500' : ''} transition-colors`}
      >
        {selectedTags.length === 0 ? (
          <span className="text-sm text-snowflake-500">Select tags...</span>
        ) : (
          selectedTags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white"
              style={{ backgroundColor: tag.color || '#3B82F6' }}
            >
              {tag.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemoveTag(tag.id, e)}
                  className="hover:opacity-75"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))
        )}
        {!disabled && (
          <ChevronDown
            className={`ml-auto h-4 w-4 text-snowflake-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-snowflake-300 rounded-md shadow-lg max-h-60 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-snowflake-200">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-snowflake-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tags..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Tag List */}
          <div className="overflow-y-auto max-h-48">
            {filteredTags.length === 0 ? (
              <div className="p-4 text-center text-sm text-snowflake-500">
                {searchQuery ? 'No tags found' : 'No tags available'}
              </div>
            ) : (
              <ul className="py-1">
                {filteredTags.map(tag => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <li
                      key={tag.id}
                      onClick={() => handleTagToggle(tag.id)}
                      className="px-3 py-2 hover:bg-snowflake-50 cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="h-4 w-4 rounded flex-shrink-0"
                          style={{ backgroundColor: tag.color || '#3B82F6' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-snowflake-900 truncate">
                            {tag.name}
                          </div>
                          {tag.description && (
                            <div className="text-xs text-snowflake-500 truncate">
                              {tag.description}
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary-600 flex-shrink-0 ml-2" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {tags.length > 0 && (
            <div className="p-2 border-t border-snowflake-200 bg-snowflake-50">
              <div className="text-xs text-snowflake-600 text-center">
                {selectedTagIds.length} of {tags.length} tags selected
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TagSelector;

