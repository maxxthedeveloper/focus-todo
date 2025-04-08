<script>
  import { onMount, tick } from 'svelte';
  import { writable } from 'svelte/store';

  // Simple browser detection that works without SvelteKit's $app/environment
  const isBrowser = typeof window !== 'undefined';

  // Saved indicator state
  let lastSavedText = "";
  let showSaveIndicator = false;

  // Gray theme color constant
  const grayThemeColor = '#9ca3af'; // Tailwind gray-400

  // --- Debounce Utility ---
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  // --- End Debounce Utility ---

  // --- LocalStorage Store Helper ---
  function localStorageStore(key, initialValue) {
    // Create writable store with initial value
    const store = writable(initialValue);
    
    // Only run in browser environment
    if (isBrowser) {
      try {
        // Try to get stored value
        const storedValue = localStorage.getItem(key);
        
        if (storedValue) {
          try {
            // Parse stored data (works for strings and JSON)
            const parsedValue = JSON.parse(storedValue);
            let isValid = false;

            // --- Validation Logic ---
            // Check if the initial value is an array (for notes)
            if (Array.isArray(initialValue)) {
              isValid = Array.isArray(parsedValue) && 
                        parsedValue.every(item => typeof item === 'object' && item !== null &&
                                        typeof item.title === 'string' &&
                                        typeof item.content === 'string');
            } 
            // Check if the initial value is a string (for theme color)
            else if (typeof initialValue === 'string') {
              isValid = typeof parsedValue === 'string';
              // Optional: Add more specific validation for hex colors if needed
              // isValid = typeof parsedValue === 'string' && /^#[0-9A-Fa-f]{6}$/.test(parsedValue); 
            }
            // --- End Validation Logic ---

            if (isValid) {
              // If valid, set store to stored value
              store.set(parsedValue);
              console.log(`Loaded data from localStorage: ${key}`, parsedValue);
            } else {
              console.warn(`Invalid data in localStorage: ${key}. Using initial value.`);
              // If invalid, explicitly set the store back to initialValue
              // and save the initial value back to localStorage to correct it.
              store.set(initialValue);
              localStorage.setItem(key, JSON.stringify(initialValue));
            }
          } catch (e) {
            console.error(`Error parsing localStorage data: ${key}`, e);
            // On parse error, also reset to initial value
            store.set(initialValue);
            localStorage.setItem(key, JSON.stringify(initialValue));
          }
        } else {
          console.log(`No data found in localStorage: ${key}. Using initial value.`);
          // If no stored value, save the initial value
          localStorage.setItem(key, JSON.stringify(initialValue));
        }
        
        // Save to localStorage whenever store changes
        const saveToLocalStorage = debounce((value) => {
          try {
            // Always stringify before saving
            localStorage.setItem(key, JSON.stringify(value));
            console.log(`Saved to localStorage: ${key}`);
            
            // Show save indicator only for notes data for now
            if (key === 'notesAppData') {
                lastSavedText = new Date().toLocaleTimeString();
                showSaveIndicator = true;
                setTimeout(() => {
                  showSaveIndicator = false;
                }, 2000);
            }
          } catch (e) {
            console.error(`Error saving to localStorage: ${key}`, e);
          }
        }, 500);
        
        // Set up subscription
        const unsubscribe = store.subscribe(saveToLocalStorage);
        
        // Clean up on page unload
        window.addEventListener('unload', unsubscribe);
      } catch (e) {
        console.error('Error accessing localStorage', e);
      }
    }
    
    return store;
  }

  // --- Placeholder Text Helper ---
  function getPlaceholderText(title) {
    if (/^Q\d$/.test(title)) { // Matches Q1, Q2, Q3, Q4
      return `Set a goal for this quarter, type [] for a todo..`;
    } else if (title === 'This week') {
      return `Set a goal for this week, type [] for a todo..`;
    } else if (title === 'Today') {
      return `Set a goal for today, type [] for a todo..`;
    }
    // Fallback placeholder if title doesn't match expected patterns
    return 'Start writing or type [] for a to-do...';
  }
  // --- End Placeholder Text Helper ---

  // --- Effectively Empty Check Helper ---
  function isEffectivelyEmpty(html) {
    if (html === null || html === undefined) {
      return true;
    }
    // Remove all <br> tags (case-insensitive) and trim whitespace
    const cleaned = html.replace(/<br\s*\/?>/gi, '').trim();
    // Return true if the cleaned string is empty
    return cleaned === '';
  }
  // --- End Effectively Empty Check Helper ---

  // Define theme colors (using hex codes for easier manipulation)
  const themeColors = [
    '#ef4444', // Red-500 (Initial)
    '#3b82f6', // Blue-500
    '#22c55e', // Green-500
    '#eab308', // Yellow-500
    '#8b5cf6', // Violet-500
    '#ec4899', // Pink-500
    '#f97316', // Orange-500
  ];

  // --- Date Helpers ---
  function getCurrentQuarter() {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    return Math.floor(month / 3) + 1; // Returns 1, 2, 3, or 4
  }

  function getQuarterString(quarter, year) {
    return `Q${quarter}`;
  }

  function getEndOfQuarter(year, quarter) {
    const endMonth = quarter * 3; // March=3, June=6, Sept=9, Dec=12
    // Create date for the *first* day of the *next* quarter, then go back 1ms
    return new Date(year, endMonth, 1, 0, 0, 0, 0) - 1; 
  }

  function getEndOfWeek() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ... 6=Saturday
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek; // Days until coming Sunday (0 if today is Sunday)
    const endOfWeek = new Date(now);
    // Set date to next Sunday, time to midnight
    endOfWeek.setDate(now.getDate() + daysUntilSunday); 
    endOfWeek.setHours(24, 0, 0, 0); // Midnight at the *end* of Sunday
    return endOfWeek;
  }

  function getEndOfDay() {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(24, 0, 0, 0); // Midnight at the *end* of today
    return endOfDay;
  }

   function formatTimeDifferenceDays(diffMillis) {
    const days = Math.max(0, Math.ceil(diffMillis / (1000 * 60 * 60 * 24))); // Round up days
    return `${days}d`;
  }

  function formatTimeDifferenceMinutes(diffMillis) {
    const minutes = Math.max(0, Math.floor(diffMillis / (1000 * 60)));
     return `${minutes}m`;
  }

  // New function for H:M:S format
  function formatTimeDifferenceHMS(diffMillis) {
    if (diffMillis <= 0) return `0s`; // Handle expired case

    const totalSeconds = Math.max(0, Math.floor(diffMillis / 1000));
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`); // Show minutes if hours>0 or minutes>0
    parts.push(`${seconds}s`); // Always show seconds

    return parts.join(' ');
  }
  // --- End Date Helpers ---

  // Get current year and quarter
  const currentYear = new Date().getFullYear();
  const currentQuarterNumber = getCurrentQuarter();
  const currentQuarterKey = getQuarterString(currentQuarterNumber, currentYear);

  // --- Initialize Notes Store (Array Structure) ---
  const initialNotesState = [
    { title: currentQuarterKey, content: '' }, // Dynamic quarter title
    { title: 'This week', content: '' },
    { title: 'Today', content: '' }
  ];

  // Create the notes store using the localStorage helper
  const notes = localStorageStore('notesAppData', initialNotesState);
  // --- End Initialize Notes Store ---

  // --- Initialize Theme Color Store ---
  const initialThemeColor = themeColors[0]; // Default to the first color
  const themeColor = localStorageStore('themeColor', initialThemeColor); 
  // --- End Initialize Theme Color Store ---

  let isTyping = false;
  let typingTimer;

  // Reactive variable for main element styles
  let mainStyle = '';

  // Reactive variables for countdowns
  let focusMessageText = '';
  let showFocusMessage = false;
  let focusMessageTimeout = null;
  let showTopFocusMessage = false; // State for the top message
  let topFocusMessageTimeout = null; // Timeout for the top message
  let quarterCountdown = '';
  let weekCountdown = '';
  let dayCountdown = ''; 

  // Function to convert hex to rgba
  function hexToRgba(hex, alpha = 0.2) { // Default alpha 20%
    // Add check for valid hex string
    if (typeof hex !== 'string' || !hex) {
      console.warn("hexToRgba received invalid input:", hex);
      // Return a default/transparent color to prevent errors
      return `rgba(0, 0, 0, 0)`; 
    }

    let r = 0, g = 0, b = 0;
    if (hex.length === 4) { // Expand shorthand hex
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex[1] + hex[2], 16);
      g = parseInt(hex[3] + hex[4], 16);
      b = parseInt(hex[5] + hex[6], 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Function to update the ::selection style globally
  let selectionStyleElement = null;
  function updateSelectionStyle(color) {
    if (!isBrowser) return; // Only run in browser
    
    // Use $themeColor store value for the color passed to hexToRgba
    const rgbaColor = hexToRgba(color, 0.3); // Use 30% opacity for selection
    if (!selectionStyleElement) {
      selectionStyleElement = document.createElement('style');
      document.head.appendChild(selectionStyleElement);
    }
    // Use !important to override potential conflicts
    selectionStyleElement.textContent = `
      ::selection { background-color: ${rgbaColor} !important; }
      ::-moz-selection { background-color: ${rgbaColor} !important; } 
    `;
  }

  // Function to handle typing state
  function handleTypingState() {
    isTyping = true;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
    }, 500);
  }

  // Function to handle clicks within any editor (for checkbox color change)
  function handleEditorClick(event) {
    // Check if the clicked element is a checkbox
    if (event.target.matches('.todo-checkbox')) {
      const checkbox = event.target;
      const isChecked = checkbox.checked; // Check the current state AFTER the click

      // Find the parent editor area to get the section title
      const editorArea = checkbox.closest('.editor-area');
      if (editorArea) {
        const sectionTitle = editorArea.dataset.title;

        // Existing theme color change logic
        let newColor;
        do {
          newColor = themeColors[Math.floor(Math.random() * themeColors.length)];
        } while (newColor === $themeColor && themeColors.length > 1); // Use $themeColor here
        
        // Update the themeColor store
        themeColor.set(newColor); // Use .set for direct update
        
        // Update selection style *with the new color*
        updateSelectionStyle(newColor); 
      }
    }
  }

  // --- Function to Check Checkbox Counts and Update Theme ---
  function checkAndUpdateTheme(currentNotes) {
    if (!isBrowser) return; // Ensure running in browser

    let anySectionHasMoreThanOneCheckbox = false;
    const tempDiv = document.createElement('div'); // Reuse one div

    for (const note of currentNotes) {
      tempDiv.innerHTML = note.content; // Parse content
      const checkboxCount = tempDiv.querySelectorAll('.todo-checkbox').length;
      if (checkboxCount > 1) {
        anySectionHasMoreThanOneCheckbox = true;
        break; // Found one, no need to check further
      }
    }
    tempDiv.innerHTML = ''; // Clear temp div content

    // Get the current theme color from the store
    const currentTheme = $themeColor;

    // Apply theme logic
    if (anySectionHasMoreThanOneCheckbox) {
      // If need to switch to gray and not already gray
      if (currentTheme !== grayThemeColor) {
        console.log("Switching theme to gray");
        // Store the current (non-gray) color before switching
        // We store it directly in localStorage for persistence across sessions
        // Note: This assumes we only want to remember *one* previous color
        localStorage.setItem('previousThemeColor', currentTheme); 
        themeColor.set(grayThemeColor); // Update the store to gray
      }
    } else {
      // If need to switch back from gray
      if (currentTheme === grayThemeColor) {
        console.log("Reverting theme from gray");
        // Try to retrieve the previously saved color from localStorage
        const savedPreviousColor = localStorage.getItem('previousThemeColor');
        if (savedPreviousColor && themeColors.includes(savedPreviousColor)) {
          themeColor.set(savedPreviousColor); // Revert to stored color
        } else {
          // Fallback if no valid previous color found in localStorage
          // Revert to the initial default color
          themeColor.set(initialThemeColor); 
        }
        // Clear the stored previous color once reverted
        localStorage.removeItem('previousThemeColor'); 
      }
      // If not gray and no section has > 1 checkbox, do nothing (keep current theme)
    }
  }
  // --- End checkAndUpdateTheme ---

  // Helper function to check if any ancestor up to the editor contains a checkbox
  function lineAlreadyHasCheckbox(startNode, editorNode) {
      let currentNode = startNode;
      // Traverse up from the starting node until we hit the editor or null
      while (currentNode && currentNode !== editorNode) {
          // Check if the current node itself is an element and contains a checkbox
          if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.querySelector('.todo-checkbox')) {
              return true; // Found a checkbox in an ancestor
          }
          // Move up to the parent node
          currentNode = currentNode.parentNode;
      }
      // If we reached the editor or null without finding a checkbox in any ancestor
      return false; 
  }

  // Function to handle input and check for [] pattern
  function handleInput(event) {
    if (!event.target.matches('.editor-area')) return;

    handleTypingState();
    const editor = event.target;
    const sectionTitle = editor.dataset.title;
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    // Check if the input likely resulted in "[]" just before the caret
    if (range && range.collapsed) {
        const node = range.startContainer;
        const offset = range.startOffset;

        // Ensure we are in a text node and there's enough text before the caret
        if (node.nodeType === Node.TEXT_NODE && offset >= 2) {
            if (node.textContent.substring(offset - 2, offset) === '[]') {
                
                // --- MODIFIED CHECK: Use upward traversal --- 
                const alreadyHasCheckbox = lineAlreadyHasCheckbox(node, editor);
                console.log("Checking for [] input. Node:", node, "Already has checkbox in line?", alreadyHasCheckbox);

                if (!alreadyHasCheckbox) { // Use the new check result
                    // Prevent default insertion of '[]' and our own replacement logic
                    event.preventDefault(); 

                    // Create the checkbox element
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'todo-checkbox';
                    checkbox.contentEditable = 'false'; // Prevent editing the checkbox itself

                    // Create a non-breaking space node to go after the checkbox
                    const spaceNode = document.createTextNode('\u00A0'); // &nbsp;

                    // --- Refined Range manipulation --- 
                    // 1. Remember the exact start position *before* deleting '[]'
                    //    Need container and offset from the original range where '[]' was detected
                    const insertContainer = range.startContainer; 
                    const insertOffset = range.startOffset - 2; // Position before '['

                    // 2. Delete the "[]" text using the original text node and offset
                    const deleteRange = document.createRange();
                    deleteRange.setStart(node, offset - 2); // node is the text node where '[]' was found
                    deleteRange.setEnd(node, offset);       // offset is position after ']'
                    deleteRange.deleteContents();

                    // 3. Insert checkbox + space *at the deletion point*
                    //    Use the remembered container and offset.
                    const insertRange = document.createRange();
                    insertRange.setStart(insertContainer, insertOffset); 
                    insertRange.collapse(true);

                    // Insert space first, then checkbox (DOM order becomes checkbox, space)
                    insertRange.insertNode(spaceNode);
                    insertRange.insertNode(checkbox);

                    // 4. Set the caret position *after* the inserted space node
                    selection.removeAllRanges(); // Clear previous selection
                    const finalRange = document.createRange();
                    finalRange.setStartAfter(spaceNode);
                    finalRange.collapse(true);
                    selection.addRange(finalRange);   // Set the new cursor position
                    // --- End Refined Range manipulation ---
                    
                    // Trigger store update manually as we prevented default input event's update
                    // Use timeout for safety after DOM manipulation
                    setTimeout(() => {
                        const currentContentHTML = editor.innerHTML;
                        const contentToSave = isEffectivelyEmpty(currentContentHTML) ? '' : currentContentHTML;
                        notes.update(currentNotes =>
                            currentNotes.map(note =>
                                note.title === sectionTitle ? { ...note, content: contentToSave } : note
                            )
                        );
                        checkAndUpdateTheme($notes); // Also check theme
                    }, 0);

                } else {
                    // Block already has a checkbox, or no block found - do nothing special.
                    // Allow default behavior (typing '[]'). The store update will happen below naturally.
                    console.log("Block already has checkbox or not found. Allowing default '[]' typing.");
                }
                // --- MODIFIED END --- 
            }
        }
    }

    // Update the store *after* DOM manipulation or default input (use timeout for safety)
    // This still runs even if we prevented default above, but it's fine.
    setTimeout(() => {
        const currentContentHTML = editor.innerHTML;
        // Check if content is just <br> tags or whitespace
        const contentToSave = isEffectivelyEmpty(currentContentHTML) ? '' : currentContentHTML;
        
        notes.update(currentNotes =>
            currentNotes.map(note =>
                note.title === sectionTitle ? { ...note, content: contentToSave } : note
            )
        );

        // --- Theme Check Logic (runs after store update) ---
        // Only run theme check if we didn't manually trigger it above
        // (Avoid double-check)
        // This check is subtle: if we *did* prevent default, the notes update happens
        // inside the `if (currentBlock && !blockAlreadyHasCheckbox)` block.
        // If we *didn't* prevent default, it happens here.
        // For simplicity, let's just call it always here. Debounce/timing should handle it ok.
        checkAndUpdateTheme($notes);
        // --- End Theme Check Logic ---
    }, 0);
  }
  // --- End handleInput ---

  // Helper function to find the block-level element containing a node
  function getBlockElement(node, editorNode) {
    let traversalNode = node; // Use a different variable for traversal
    while (traversalNode && traversalNode !== editorNode) { // Traverse up until the editor boundary
        // Handle text nodes by checking their parent
        const checkNode = traversalNode.nodeType === Node.TEXT_NODE ? traversalNode.parentNode : traversalNode;
        if (!checkNode || checkNode === editorNode) {
            break; // Stop if parent is editor or null
        }

        const display = window.getComputedStyle(checkNode).display;
        // Check if the node is considered block-level
        if (['block', 'list-item', 'table-cell', 'flex', 'grid'].includes(display)) {
            return checkNode;
        }
        // If it's an inline element within the editor, continue up
        traversalNode = checkNode.parentNode;
    }
    // If no block element found below the editor, return the editor itself
    // or null if the initial node was somehow outside
    const result = traversalNode === editorNode ? editorNode : null;
    return result;
  }

  // --- handleKeydown (handles Enter and Backspace for checkboxes) ---
  function handleKeydown(event) {
    const editor = event.target;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    if (event.key === 'Enter') {
      console.log('Enter key pressed');
      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      console.log('Enter press container:', container); // Keep log for now

      // --- SIMPLIFIED CHECK: Look at immediate parent or container --- 
      let isOnTodoLine = false;
      if (container.nodeType === Node.TEXT_NODE && container.parentNode) {
          // Cursor is in a text node, check its direct parent element
          isOnTodoLine = container.parentNode.querySelector('.todo-checkbox') !== null;
          console.log('Enter check: Text node parent check:', container.parentNode, isOnTodoLine);
      } else if (container.nodeType === Node.ELEMENT_NODE) {
          // Cursor container is an element, check it directly
          isOnTodoLine = container.querySelector('.todo-checkbox') !== null;
          // Also check if the element itself *is* the editor (should not be treated as todo line)
          if (container === editor) {
              isOnTodoLine = false; 
          }
          console.log('Enter check: Element container check:', container, isOnTodoLine);
      }
      // --- End simplified check ---

      // Use the revised 'isOnTodoLine' condition
      if (isOnTodoLine) {
          // --- Checkbox Line Enter Logic --- 
          event.preventDefault(); // Prevent default ONLY for checkbox lines
          console.log('Condition met: Inserting new checkbox...');
          // Create elements first
          const br = document.createElement('br');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'todo-checkbox';
          checkbox.contentEditable = 'false';
          const spaceNode = document.createTextNode('\u00A0'); // &nbsp;

          // Insert elements sequentially, adjusting range each time
          range.insertNode(br);
          range.setStartAfter(br);
          range.collapse(true);

          range.insertNode(checkbox);
          range.setStartAfter(checkbox);
          range.collapse(true);

          range.insertNode(spaceNode);

          // Set final cursor position explicitly after the last node
          const finalRange = document.createRange();
          finalRange.setStartAfter(spaceNode);
          finalRange.collapse(true);

          selection.removeAllRanges();
          selection.addRange(finalRange);

          // --- End Focus Message Logic ---
          setTimeout(() => {
             const sectionTitle = editor.dataset.title;
             const currentContentHTML = editor.innerHTML;
             // Check if content is just <br> tags or whitespace
             const contentToSave = isEffectivelyEmpty(currentContentHTML) ? '' : currentContentHTML;
             notes.update(currentNotes =>
                 currentNotes.map(note =>
                     note.title === sectionTitle ? { ...note, content: contentToSave } : note
                 )
             );
             // Count checkboxes in the *current* section after adding one
             const tempDiv = document.createElement('div');
             tempDiv.innerHTML = currentContentHTML; // Use content just added
             const checkboxCount = tempDiv.querySelectorAll('.todo-checkbox').length;

             // Show bottom message *only* when the count becomes exactly 2
             if (checkboxCount === 2) {
                 console.log("Showing bottom focus message - count became 2");
                 focusMessageText = "focus on one goal that matters";
                 showFocusMessage = true;
                 clearTimeout(focusMessageTimeout); // Clear previous timer if any
                 focusMessageTimeout = setTimeout(() => {
                     showFocusMessage = false;
                 }, 4000); // Hide after 4 seconds
             }
             // Show top message *only* when the count becomes exactly 3
             else if (checkboxCount === 3) {
                 console.log("Showing top focus message - count became 3");
                 showTopFocusMessage = true;
                 clearTimeout(topFocusMessageTimeout); // Clear previous top timer
                 topFocusMessageTimeout = setTimeout(() => {
                    showTopFocusMessage = false;
                 }, 4000); // Hide after 4 seconds
             }
         }, 0);
         // --- End Checkbox Line Enter Logic --- 
      } else {
          // --- Normal Enter Logic --- 
          console.log('Condition NOT met: Allowing default browser Enter behavior...');
          // No event.preventDefault() here.
          // The browser will insert <br> or wrap in <div>/</div> etc.
          // The subsequent 'input' event will trigger handleInput, which updates the store.
          handleTypingState(); // Still indicate typing is happening
          // --- End Normal Enter Logic ---
      }
    } else if (event.key === 'Backspace') {
      console.log("--- Backspace Keydown Start ---");
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
          console.log("Backspace: No selection or range count is 0");
          return;
      }

      const range = selection.getRangeAt(0);
      const container = range.startContainer; 
      const offset = range.startOffset;      
      const editor = event.target;
      console.log(`Backspace Context: Container Node=`, container);
      console.log(`Backspace Context: Container Type=`, container.nodeType);
      console.log(`Backspace Context: Container Name=`, container.nodeName);
      console.log(`Backspace Context: Offset=`, offset);

      if (!selection.isCollapsed) { 
        console.log("Backspace on selection - allowing default");
        handleTypingState(); 
        return;
      }
      
      // --- ADDED: Specific check for cursor AFTER the space node --- 
      if (container.nodeType === Node.TEXT_NODE && container.textContent === '\u00A0' && offset >= 1) { // Offset 1 or 2, depending on browser
          console.log("Backspace Check: Cursor is at the end of the space node.");
          const checkboxToRemove = container.previousSibling;
          if (checkboxToRemove && checkboxToRemove.nodeType === Node.ELEMENT_NODE && checkboxToRemove.classList.contains('todo-checkbox')) {
              console.log("HANDLING VIA NEW CHECK: Backspace deleting space node and preceding checkbox.");
              event.preventDefault();

              // Check and remove preceding BR (copied from Case 1)
              const brToRemove = checkboxToRemove.previousSibling;
              if (brToRemove && brToRemove.nodeName === 'BR') {
                  console.log("HANDLING: Also removing preceding BR tag.");
                  brToRemove.remove();
              }

              // Remove checkbox and space node
              checkboxToRemove.remove();
              container.remove(); // Remove the space node itself

              // Update store & theme
              setTimeout(() => {
                  const sectionTitle = editor.dataset.title;
                  const currentContentHTML = editor.innerHTML;
                  const contentToSave = isEffectivelyEmpty(currentContentHTML) ? '' : currentContentHTML;
                  notes.update(currentNotes => currentNotes.map(note => note.title === sectionTitle ? { ...note, content: contentToSave } : note));
                  checkAndUpdateTheme($notes);
              }, 0);
              return; // Handled
          }
      }
      // --- END ADDED CHECK ---

      // Get the node immediately before the logical cursor position within the container
      const nodeBefore = offset > 0 ? container.childNodes[offset - 1] : null;
      console.log(`Backspace Check: nodeBefore=`, nodeBefore); 
      if(nodeBefore) {
        console.log(`Backspace Check: nodeBefore Type=`, nodeBefore.nodeType);
        console.log(`Backspace Check: nodeBefore Name=`, nodeBefore.nodeName);
        console.log(`Backspace Check: nodeBefore Text=`, nodeBefore.textContent);
      }

      if (nodeBefore) {
        // === CASE 1: Node before cursor is the &nbsp; text node ===
        console.log("Backspace Check: Evaluating Case 1 (Space Node Check)");
        if (nodeBefore.nodeType === Node.TEXT_NODE && nodeBefore.textContent === '\u00A0') {
          console.log("Backspace Check: Case 1 Condition Met (Node is Space)");
          const checkboxToRemove = nodeBefore.previousSibling;
          console.log(`Space Node Check: Node before space=`, checkboxToRemove);
          if (checkboxToRemove && checkboxToRemove.nodeType === Node.ELEMENT_NODE && checkboxToRemove.classList.contains('todo-checkbox')) {
            console.log("HANDLING VIA CASE 1: Backspace deleting space node after checkbox.");
            event.preventDefault();

            // Check and remove preceding BR
            const brToRemove = checkboxToRemove.previousSibling;
            if (brToRemove && brToRemove.nodeName === 'BR') {
              console.log("HANDLING: Also removing preceding BR tag.");
              brToRemove.remove();
            }

            // Remove checkbox and space node
            checkboxToRemove.remove();
            nodeBefore.remove(); // Remove the space node

            // Update store & theme
            setTimeout(() => {
                const sectionTitle = editor.dataset.title;
                const currentContentHTML = editor.innerHTML;
                 // Check if content is just <br> tags or whitespace
                const contentToSave = isEffectivelyEmpty(currentContentHTML) ? '' : currentContentHTML;
                notes.update(currentNotes => currentNotes.map(note => note.title === sectionTitle ? { ...note, content: contentToSave } : note));
                checkAndUpdateTheme($notes);
            }, 0);
            return; // Handled
          }
        }

        // === CASE 2: Node before cursor is the checkbox element itself ===
        console.log("Backspace Check: Evaluating Case 2 (Checkbox Node Check)");
        if (nodeBefore.nodeType === Node.ELEMENT_NODE && nodeBefore.classList.contains('todo-checkbox')) {
          console.log("Backspace Check: Case 2 Condition Met (Node is Checkbox)");
          event.preventDefault();
          console.log("HANDLING VIA CASE 2: Backspace deleting checkbox element directly.");
          const checkboxToRemove = nodeBefore;

          // Check and remove following space node
          const spaceNodeToRemove = checkboxToRemove.nextSibling;
          if (spaceNodeToRemove && spaceNodeToRemove.nodeType === Node.TEXT_NODE && spaceNodeToRemove.textContent === '\u00A0') {
             console.log("HANDLING: Also removing following space node.");
             spaceNodeToRemove.remove();
          }

          // Remove checkbox
          checkboxToRemove.remove();

          // Update store & theme
          setTimeout(() => {
              const sectionTitle = editor.dataset.title;
              const currentContentHTML = editor.innerHTML;
               // Check if content is just <br> tags or whitespace
              const contentToSave = isEffectivelyEmpty(currentContentHTML) ? '' : currentContentHTML;
              notes.update(currentNotes => currentNotes.map(note => note.title === sectionTitle ? { ...note, content: contentToSave } : note));
              checkAndUpdateTheme($notes);
          }, 0);
          return; // Handled
        }
      }

      // --- Specific check for Backspace at the very beginning --- 
      console.log("Backspace Check: Evaluating Case 3 (Empty Editor Start Check)");
      // Check if cursor is at offset 0 within the main editor element itself
      if (offset === 0 && container === editor) {
        // Check if the editor is effectively empty (contains nothing or just a single <br>)
        const currentHTML = editor.innerHTML.trim();
        if (isEffectivelyEmpty(currentHTML)) { // Use helper function here too
          console.log("HANDLING: Backspace pressed at start of effectively empty editor.");
          event.preventDefault(); // Prevent default backspace
          if (editor.innerHTML !== '') { // Avoid unnecessary DOM update if already empty
            editor.innerHTML = ''; // Ensure it's truly empty
            // Update store immediately since we changed content
            setTimeout(() => {
              const sectionTitle = editor.dataset.title;
              // Ensure we save an empty string
              notes.update(currentNotes => currentNotes.map(note => note.title === sectionTitle ? { ...note, content: '' } : note));
              checkAndUpdateTheme($notes); // Check theme in case removing last item affects it
            }, 0);
          }
          return; // Handled
        }
      }
      // --- End specific check ---

      // --- If neither case handled it, allow default --- 
      console.log("ALLOWING DEFAULT: Backspace - No specific handling triggered.");
      handleTypingState();
      console.log("--- Backspace Keydown End ---");

    } else {
        // Handle typing state for other keys
        handleTypingState();
    }
  }
  // --- End handleKeydown ---

  // Svelte action to initialize the contenteditable element and handle updates safely
  function initContent(node, initialContent) {
    // Set the initial content directly on first run, ensuring empty string clears innerHTML
    node.innerHTML = initialContent;

    return {
      update(newContent) {
        // Only update the innerHTML if the element is NOT focused
        // AND if the content has actually changed.
        // This prevents the action from interfering with user typing and direct DOM manipulation.
        if (document.activeElement !== node && node.innerHTML !== newContent) {
            node.innerHTML = newContent;
            // Optional: log when the action updates content
            // console.log("initContent action updated non-focused editor:", node.dataset.title);
        }
      }
      // No destroy needed currently
    };
  }

  // Reactive statement to update mainStyle whenever themeColor store changes
  $:
  {
    // Read the current theme color directly from the store
    const currentTheme = $themeColor;
    const hoverColor = hexToRgba(currentTheme, 0.16); // Calculate hover color with 16% alpha
    const bgColor = hexToRgba(currentTheme, 0.03);    // Calculate background color with 3% alpha
    mainStyle = `--theme-color: ${currentTheme}; --theme-color-hover: ${hoverColor}; background-color: ${bgColor};`; // Add background-color
    // Also update selection style whenever theme changes
    updateSelectionStyle(currentTheme);
  }

  onMount(() => {
    if (!isBrowser) return; // Guard against server-side execution
    
    // --- Initial Countdown Calculation (Content rendering handled by template) ---
    function initializeCountdowns() {
      // Calculate initial countdowns
      const now = new Date().getTime(); // Current time in milliseconds

      // Quarter
      const endOfQuarterMillis = getEndOfQuarter(currentYear, currentQuarterNumber);
      quarterCountdown = formatTimeDifferenceDays(endOfQuarterMillis - now);

      // Week
      const endOfWeekMillis = getEndOfWeek().getTime();
      weekCountdown = formatTimeDifferenceDays(endOfWeekMillis - now);

      // Day - Use new HMS formatter
      const endOfDayMillis = getEndOfDay().getTime();
      dayCountdown = formatTimeDifferenceHMS(endOfDayMillis - now); // Use HMS format
    }

    // Initial call for countdowns
    initializeCountdowns();

    // Interval to update countdowns frequently
    const countdownUpdateInterval = setInterval(() => {
      const now = new Date().getTime();
      const endOfDayMillis = getEndOfDay().getTime();
      dayCountdown = formatTimeDifferenceHMS(endOfDayMillis - now); // Only update day frequently
    }, 1000); // Update every second

    // Interval to update week/quarter less frequently (e.g., every minute)
    const longerInterval = setInterval(() => {
      const now = new Date().getTime();
      const endOfQuarterMillis = getEndOfQuarter(currentYear, currentQuarterNumber);
      quarterCountdown = formatTimeDifferenceDays(endOfQuarterMillis - now);
      const endOfWeekMillis = getEndOfWeek().getTime();
      weekCountdown = formatTimeDifferenceDays(endOfWeekMillis - now);
    }, 60000); // Update every minute

    // --- Quarter Change Check ---
    const quarterCheckInterval = setInterval(() => {
      const now = new Date();
      const newQuarterNumber = getCurrentQuarter();
      const newYear = now.getFullYear();
      const newQuarterKey = getQuarterString(newQuarterNumber, newYear); // e.g., "Q4"

      // Use $notes to read the current store value
      const currentNotesValue = $notes;
      // Find the note that likely holds the quarter data (with title starting with 'Q')
      const quarterNoteIndex = currentNotesValue.findIndex(note => /^Q\d$/.test(note.title));

      if (quarterNoteIndex !== -1) {
        const oldQuarterTitle = currentNotesValue[quarterNoteIndex].title;

        if (newQuarterKey !== oldQuarterTitle) {
          console.log(`Quarter changed! Old: ${oldQuarterTitle}, New: ${newQuarterKey}`);
          // Update the store: find the note by old title and change its title property
          notes.update(currentNotes =>
            currentNotes.map(note =>
              note.title === oldQuarterTitle ? { ...note, title: newQuarterKey } : note
            )
          );
          // Recalculate countdowns
          initializeCountdowns(); // Re-init countdowns only
        }
      } else {
        console.warn("Could not find the Quarter note object in the store to check for updates.");
      }
    }, 3600 * 1000); // Check every hour

    // Cleanup timer and intervals on unmount
    return () => {
      clearTimeout(typingTimer);
      clearInterval(quarterCheckInterval); 
      clearInterval(countdownUpdateInterval);
      clearInterval(longerInterval); // Clear the less frequent interval too
      clearTimeout(focusMessageTimeout); // Clear focus message timeout on unmount
      clearTimeout(topFocusMessageTimeout); // Clear top focus message timeout on unmount
      if (selectionStyleElement && selectionStyleElement.parentNode) {
        selectionStyleElement.parentNode.removeChild(selectionStyleElement);
      }
    };
  });
</script>

<main 
  class="flex flex-col items-center justify-center min-h-screen w-full pt-8 pb-16 space-y-2"
  style={mainStyle}
>
  <!-- Top Focus Message Indicator -->
  <div
    class="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-3 py-2 rounded-full shadow-md 
           transition-all duration-500 ease-in-out -translate-y-full"
    class:opacity-0={!showTopFocusMessage}
    class:opacity-100={showTopFocusMessage}
    class:-translate-y-full={!showTopFocusMessage} 
    class:translate-y-0={showTopFocusMessage}
    style="background-color: #DC2626; color: white;"
  >
    <!-- Start offscreen above when hidden, slide down when shown -->
    Focus!
  </div>

  <!-- Iterate over the notes array from the store -->
  {#each $notes as note (note.title)}
    <!-- Section -->
    <section class="w-full max-w-lg px-4">
      <!-- Section Title Row -->
      <h2 class="text-xl font-medium text-black/80 mb-3 flex items-center space-x-2">
        <span>{note.title}</span>
        <!-- Countdown Pill -->
        {#if /^Q\d$/.test(note.title)}
          <span class="countdown-pill">
              {quarterCountdown}
          </span>
        {:else if note.title === 'This week'}
            <span class="countdown-pill">
              {weekCountdown}
          </span>
        {:else if note.title === 'Today'}
           <span class="countdown-pill today-countdown">
              {dayCountdown}
          </span>
        {/if}
      </h2>
      
      <!-- ContentEditable Editor Area -->
      <!-- Bind the innerHTML to the store content -->
      <!-- NOTE: Using @html directive for initial render to handle saved HTML -->
      <div
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        tabindex="0"
        data-title={note.title}
        class="flex-grow focus:outline-none text-gray-800 editor-area"
        class:typing={isTyping}
        placeholder={getPlaceholderText(note.title)}
        style="line-height: 1.6;"
        use:initContent={note.content}
        on:input={handleInput} 
        on:keydown={handleKeydown}
        on:click={handleEditorClick}
      ></div>
    </section>
  {/each}

  <!-- Save Indicator -->
  <div
    class="fixed bottom-4 right-4 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full shadow-sm transition-opacity duration-300"
    class:opacity-0={!showSaveIndicator}
    class:opacity-100={showSaveIndicator}
  >
    Saved at {lastSavedText}
  </div>

  <!-- Focus Message Indicator -->
  <div
    class="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 px-3 py-2 rounded-full shadow-md 
           transition-all duration-500 ease-in-out translate-y-full"
    class:opacity-0={!showFocusMessage}
    class:opacity-100={showFocusMessage}
    class:translate-y-full={!showFocusMessage}
    class:translate-y-0={showFocusMessage}
    style="background-color: #007AFF; color: white;"
  >
    <!-- Start offscreen below when hidden, slide up when shown -->
    {focusMessageText}
  </div>
</main>

<style>
  /* Style the contenteditable div like a textarea */
  .editor-area {
    font-size: 1.1rem; 
    white-space: pre-wrap; /* Preserve whitespace and wrap lines */
    word-wrap: break-word; /* Break long words */
    min-height: 80px; /* Min-height per section */
    caret-color: var(--theme-color); 
    border: 1px solid transparent; /* Add border for layout stability during focus */
  }

  /* Add focus style - Temporarily commented out for debugging */
  /* .editor-area:focus {
      border-color: #cbd5e1; 
      outline: none; 
  } */

  /* Temporarily comment out blink animation */
  /* .editor-area:not(.typing) {
    animation: blink 0.75s step-end infinite;
    -webkit-animation: blink 0.75s step-end infinite;
  } */

  /* Placeholder styling for contenteditable div */
  [contenteditable][placeholder]:empty:before {
    content: attr(placeholder);
    color: rgba(0, 0, 0, 0.44); /* Changed from #a0aec0 (gray-500) to black 44% */
    cursor: text;
    pointer-events: none; 
    display: block; /* Needed for placeholder */
  }

  /* Temporarily comment out blink animation keyframes */
  /* @keyframes blink {
    0%, 100% { caret-color: transparent; }
    50% { caret-color: var(--theme-color); }
  } */

  /* @-webkit-keyframes blink {
    0%, 100% { caret-color: transparent; }
    50% { caret-color: var(--theme-color); }
  } */

  /* Countdown Pill Styles */
  .countdown-pill {
    @apply text-xs font-medium px-2 py-0.5 rounded-full inline-block;
    background-color: rgba(0, 0, 0, 0.06); /* Changed from 8% to 6% black */
    color: rgba(0, 0, 0, 0.32); /* Changed from 24% to 32% black */
    white-space: nowrap; /* Prevent wrapping */
    transition: color 0.3s ease, background-color 0.3s ease;
  }

  /* Specific class for the Today countdown animation & fixed width */
  .today-countdown {
      animation: pulse 2s infinite ease-in-out;
      min-width: 5em; /* Use min-width */
      text-align: center;
      padding-left: 0.5rem;
      padding-right: 0.5rem;
  }

  /* Subtle Pulse animation for Today countdown */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  /* Custom styles for the To-Do Checkbox */
  :global(.todo-checkbox) {
    appearance: none;
    -webkit-appearance: none;
    background-color: transparent; 
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--theme-color); 
    border-radius: 0.25rem;
    margin-right: 0.1rem; /* Reduced margin even further */
    cursor: pointer;
    display: inline-block;
    position: relative; /* Enable relative positioning */
    top: 1.6px; /* Nudge the checkbox down slightly */
    transition: background-color 0.2s ease; /* Add transition for hover */
  }

  /* Style for hover state (only when NOT checked) */
  :global(.todo-checkbox:not(:checked):hover) {
    background-color: var(--theme-color-hover); /* Use the hover variable */
  }

  /* Style for the checked state */
  :global(.todo-checkbox:checked) {
    background-color: var(--theme-color); 
    border-color: var(--theme-color); 
    background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
    background-size: 100% 100%;
    background-position: center;
    background-repeat: no-repeat;
  }

  /* === MOVED CELEBRATION STYLES START === */
  /* Celebration styles */
  .celebration-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999; /* Very high z-index */
    overflow: hidden; /* Prevent scrollbars */
    pointer-events: none; /* Allow interactions with content underneath */
  }

  .fire-emoji {
    position: absolute;
    display: inline-block;
    opacity: 0; /* Start invisible, animation makes it visible */
    will-change: transform, opacity; /* Hint for browser optimization */
    /* Start scaled down */
    transform: scale(0);
  }

  /* Simple explosion animation: scale up and fade out */
  @keyframes explode {
    0% {
      opacity: 1;
      transform: scale(0.5); /* Start slightly visible and small */
    }
    50% {
       opacity: 1;
       transform: scale(1.2); /* Grow */
    }
    100% {
      opacity: 0;
      transform: scale(2.5); /* Expand further while fading */
    }
  }
  /* === MOVED CELEBRATION STYLES END === */
</style> 