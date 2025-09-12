export interface DragState {
    isDragging: boolean;
    startIndex: number;
    startY: number;
    currentY: number;
    draggedElement: HTMLElement | null;
    currentHighlightIndex: number;
}

export interface DragDropCallbacks {
    onReorder: (fromIndex: number, toIndex: number) => Promise<void>;
}

export class DragDropManager {
    private dragState: DragState;
    private callbacks: DragDropCallbacks;

    constructor(callbacks: DragDropCallbacks) {
        this.callbacks = callbacks;
        this.dragState = {
            isDragging: false,
            startIndex: -1,
            startY: 0,
            currentY: 0,
            draggedElement: null,
            currentHighlightIndex: -1
        };
    }

    public handleDragStart = (e: PointerEvent, index: number): void => {
        // Only allow drag if it starts from the drag handle
        const isDragHandle = e.target instanceof HTMLElement && 
                           (e.target.classList.contains('drag-handle') || 
                            e.target.closest('.drag-handle'));
        
        if (!isDragHandle) {
            return;
        }

        // Allow both mouse (button 0) and touch (no button) events
        if (e.button === 0 || e.pointerType === 'touch') {
            // Prevent text selection during drag
            e.preventDefault();
            
            this.dragState.isDragging = true;
            this.dragState.startIndex = index;
            this.dragState.startY = e.clientY;
            this.dragState.currentY = e.clientY;
            
            // Store reference to the dragged element
            const container = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
            this.dragState.draggedElement = container;
            
            // Set visual feedback
            if (container) {
                container.style.opacity = '0.4';
                container.style.transform = 'scale(0.95)';
            }
            
            // Disable text selection on the body during drag
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';
            
            // Prevent default touch behaviors
            if (e.pointerType === 'touch') {
                document.body.style.touchAction = 'none';
            }
            
            // Capture pointer for this element
            if (e.currentTarget instanceof HTMLElement) {
                e.currentTarget.setPointerCapture(e.pointerId);
            }
            
            // Add global pointer move listener during drag
            const handleGlobalPointerMove = (globalEvent: PointerEvent) => {
                if (this.dragState.isDragging && globalEvent.pointerId === e.pointerId) {
                    globalEvent.preventDefault(); // Prevent scrolling on touch
                    this.dragState.currentY = globalEvent.clientY;
                    const targetIndex = this.getTargetIndexFromPosition(globalEvent.clientX, globalEvent.clientY);
                    
                    // Only update highlights if still dragging and target index actually changed
                    if (this.dragState.isDragging && targetIndex !== this.dragState.currentHighlightIndex) {
                        this.dragState.currentHighlightIndex = targetIndex;
                        
                        // Only highlight if we have a valid target that's different from start
                        if (targetIndex !== -1 && targetIndex !== this.dragState.startIndex) {
                            this.highlightDropZone(targetIndex, this.dragState.startIndex);
                        } else {
                            // Clear all highlights if no valid target or same as start
                            this.clearAllHighlights();
                        }
                    }
                }
            };
            
            const handleGlobalPointerUp = (globalEvent: PointerEvent) => {
                if (this.dragState.isDragging && globalEvent.pointerId === e.pointerId) {
                    const deltaY = Math.abs(this.dragState.currentY - this.dragState.startY);
                    const targetIndex = this.getTargetIndexFromPosition(globalEvent.clientX, globalEvent.clientY);
                    
                    // Clear highlights immediately before any reorder operation
                    this.clearAllHighlights();
                    this.dragState.currentHighlightIndex = -1;
                    
                    // Use smaller threshold for touch devices (10px vs 20px for mouse)
                    const threshold = globalEvent.pointerType === 'touch' ? 10 : 20;
                    
                    // If we moved significantly and to a different index, perform the reorder
                    if (deltaY > threshold && targetIndex !== -1 && this.dragState.startIndex !== targetIndex) {
                        this.callbacks.onReorder(this.dragState.startIndex, targetIndex);
                    }
                    
                    // Reset visual feedback
                    this.resetDragState();
                    
                    // Remove global listeners
                    document.removeEventListener('pointermove', handleGlobalPointerMove);
                    document.removeEventListener('pointerup', handleGlobalPointerUp);
                }
            };
            
            // Add global listeners for the duration of the drag
            document.addEventListener('pointermove', handleGlobalPointerMove);
            document.addEventListener('pointerup', handleGlobalPointerUp);
        }
    };
    
    public handleDragMove = (e: PointerEvent, index: number): void => {
        if (this.dragState.isDragging) {
            this.dragState.currentY = e.clientY;
            const deltaY = this.dragState.currentY - this.dragState.startY;
            
            // Calculate which deck item we're over based on mouse position
            const targetIndex = this.getTargetIndexFromPosition(e.clientX, e.clientY);
            
            // Only update highlights if still dragging and target index actually changed
            if (this.dragState.isDragging && targetIndex !== this.dragState.currentHighlightIndex) {
                this.dragState.currentHighlightIndex = targetIndex;
                
                // Only highlight if we have a valid target that's different from start
                if (targetIndex !== -1 && targetIndex !== this.dragState.startIndex) {
                    this.highlightDropZone(targetIndex, this.dragState.startIndex);
                } else {
                    // Clear all highlights if no valid target or same as start
                    this.clearAllHighlights();
                }
            }
        }
    };
    
    private getTargetIndexFromPosition(x: number, y: number): number {
        const deckWrappers = document.querySelectorAll('.deck-item-wrapper');
        
        for (let i = 0; i < deckWrappers.length; i++) {
            const wrapper = deckWrappers[i];
            if (wrapper instanceof HTMLElement) {
                const rect = wrapper.getBoundingClientRect();
                
                // Check if the mouse is within this wrapper's bounds
                if (x >= rect.left && x <= rect.right && 
                    y >= rect.top && y <= rect.bottom) {
                    return i;
                }
            }
        }
        
        // If not directly over any wrapper, find the closest one by Y position
        let closestIndex = -1;
        let closestDistance = Infinity;
        
        for (let i = 0; i < deckWrappers.length; i++) {
            const wrapper = deckWrappers[i];
            if (wrapper instanceof HTMLElement) {
                const rect = wrapper.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                const distance = Math.abs(y - centerY);
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = i;
                }
            }
        }
        
        return closestIndex;
    }
    
    public handleDragEnd = (e: PointerEvent, index: number): void => {
        if (this.dragState.isDragging) {
            const deltaY = Math.abs(this.dragState.currentY - this.dragState.startY);
            
            // Calculate the actual target index based on final position
            const targetIndex = this.getTargetIndexFromPosition(e.clientX, e.clientY);
            
            // Clear highlights immediately
            this.clearAllHighlights();
            this.dragState.currentHighlightIndex = -1;
            
            // Use smaller threshold for touch devices (10px vs 20px for mouse)
            const threshold = e.pointerType === 'touch' ? 10 : 20;
            
            // If we moved significantly and to a different index, perform the reorder
            if (deltaY > threshold && targetIndex !== -1 && this.dragState.startIndex !== targetIndex) {
                this.callbacks.onReorder(this.dragState.startIndex, targetIndex);
            }
            
            // Reset visual feedback
            this.resetDragState();
        }
    };
    
    private highlightDropZone(currentIndex: number, startIndex: number): void {
        // Remove all existing highlights first
        this.clearAllHighlights();
        
        // Only apply highlight if we have a valid target that's different from start
        if (currentIndex !== -1 && currentIndex !== startIndex) {
            const wrappers = document.querySelectorAll('.deck-item-wrapper');
            const targetWrapper = wrappers[currentIndex];
            
            if (targetWrapper instanceof HTMLElement) {
                if (currentIndex > startIndex) {
                    targetWrapper.style.borderBottom = '3px solid #3E92CC';
                } else {
                    targetWrapper.style.borderTop = '3px solid #3E92CC';
                }
                targetWrapper.style.background = 'rgba(62, 146, 204, 0.1)';
            }
        }
    }
    
    private clearAllHighlights(): void {
        document.querySelectorAll('.deck-item-wrapper').forEach(el => {
            if (el instanceof HTMLElement) {
                el.style.borderTop = '';
                el.style.borderBottom = '';
                el.style.background = '';
            }
        });
    }
    
    private resetDragState(): void {
        // Mark as no longer dragging first to prevent further updates
        this.dragState.isDragging = false;
        this.dragState.currentHighlightIndex = -1;
        
        // Re-enable text selection
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        
        // Re-enable touch behaviors
        document.body.style.touchAction = '';
        
        // Reset dragged element visual state
        if (this.dragState.draggedElement) {
            this.dragState.draggedElement.style.opacity = '';
            this.dragState.draggedElement.style.transform = '';
        }
        
        // Clear all drop zone highlights
        this.clearAllHighlights();
        
        // Use a small timeout to ensure any pending highlight updates are cancelled
        setTimeout(() => {
            this.clearAllHighlights();
        }, 10);
        
        // Reset state
        this.dragState.startIndex = -1;
        this.dragState.draggedElement = null;
    }

    public get isDragging(): boolean {
        return this.dragState.isDragging;
    }

    public cleanup(): void {
        this.resetDragState();
    }
}

// Utility function for simple drag and drop arrays
export function performArrayReorder<T>(array: T[], fromIndex: number, toIndex: number): T[] {
    const newArray = [...array];
    const draggedItem = newArray[fromIndex];
    
    // Remove item from old position
    newArray.splice(fromIndex, 1);
    // Insert at new position
    newArray.splice(toIndex, 0, draggedItem);
    
    return newArray;
}