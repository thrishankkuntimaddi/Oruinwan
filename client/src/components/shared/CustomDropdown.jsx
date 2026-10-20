import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import '../../styles/gloss.css';
import './customDropdown.css';

const CustomDropdown = ({ options, value, onChange, placeholder, icon: Icon, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(opt => opt.value === value);

    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    
    useEffect(() => {
        if (!isOpen) {
            setSelectedIndex(-1);
            return;
        }

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                onChange(options[selectedIndex].value);
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedIndex, options, onChange]);

    
    useEffect(() => {
        if (selectedIndex >= 0 && dropdownRef.current) {
            const listItem = dropdownRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            if (listItem) {
                listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex]);

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    const listId = `dd-${(label || placeholder || 'list').replace(/\W+/g, '-').toLowerCase()}`;

    return (
        <div className="sdd-field">
            {label && <label htmlFor={`${listId}-btn`}>{label}</label>}
            <div className="sdd" ref={dropdownRef}>
                <button
                    id={`${listId}-btn`}
                    type="button"
                    className="gl-input sdd-trigger"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-controls={listId}
                >
                    <span className="sdd-value" data-empty={selectedOption ? undefined : 'true'}>
                        {Icon && <Icon size={16} aria-hidden="true" />}
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronDown size={16} className="sdd-chev" data-open={isOpen ? 'true' : undefined} aria-hidden="true" />
                </button>

                {isOpen && (
                    <div className="sdd-menu" id={listId} role="listbox">
                        {options.map((option, index) => {
                            const isSelected = option.value === value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    data-index={index}
                                    data-active={index === selectedIndex ? 'true' : undefined}
                                    className="sdd-option"
                                    onClick={() => handleSelect(option.value)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <span>{option.label}</span>
                                    {isSelected && <Check size={15} aria-hidden="true" />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomDropdown;
