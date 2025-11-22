# xnote AI Features - Implementation Roadmap

**Current Phase:** ✅ Phase 1 Complete
**Next Phase:** Phase 2 - Inline AI with Floating Toolbar

---

## Phase 1: AI-Assisted Note Drafting ✅ DONE

### Backend
- [x] Add `@google/genai` dependency
- [x] Initialize Gemini client in main.js
- [x] Implement IPC handlers for AI generation
- [x] Support streaming responses
- [x] Handle multimodal input (text + images)
- [x] Auto-initialize on app startup if API key exists

### Settings
- [x] Create AI Settings modal UI
- [x] API key input (password field)
- [x] Model selector (4 Gemini models)
- [x] System prompt customization
- [x] Save/load settings from data.json
- [x] Add settings gear icon to toolbar

### Floating Input UI
- [x] Design minimal, condensed UI
- [x] Bottom-center positioning
- [x] Auto-growing textarea
- [x] Model selector (hidden, shows on hover)
- [x] Image paste support with thumbnails
- [x] Professional button with state transitions
- [x] Keyboard shortcuts (Cmd+Y, Esc, Enter, Shift+Enter)
- [x] Close button and Esc handler

### AI Generation
- [x] Context-aware generation (current note + prompt)
- [x] Streaming implementation
- [x] Markdown to HTML conversion for rich mode
- [x] Header glow animation during processing
- [x] Stop generation functionality
- [x] Auto-retry logic (3 attempts)
- [x] Error handling with user feedback
- [x] Toast notifications

### Bug Fixes
- [x] Fix Gemini API method calls
- [x] Fix markdown rendering in rich mode
- [x] Enhance header glow visibility
- [x] Redesign button UX (no overlap)
- [x] Remove unnecessary white-space CSS

---

## Phase 2: Inline AI with Floating Toolbar 🔄 NEXT

### Selection Detection
- [ ] Detect text selection in rich editor
- [ ] Detect text selection in markdown editor
- [ ] Show/hide toolbar based on selection state
- [ ] Handle selection across multiple paragraphs

### Floating Toolbar UI
- [ ] Create minimal toolbar component
- [ ] Position near selection (smart positioning)
- [ ] Add "AI" icon/button to toolbar
- [ ] Model selector dropdown
- [ ] Quick action buttons (optional):
  - [ ] "Improve writing"
  - [ ] "Make shorter"
  - [ ] "Expand"
  - [ ] "Fix grammar"

### Inline Prompt Input
- [ ] Click AI button → show inline prompt input
- [ ] Compact input field with placeholder
- [ ] Enter to submit
- [ ] Esc to cancel
- [ ] Loading indicator during generation
- [ ] Smooth animations

### Text Replacement
- [ ] Send selected text + prompt to AI
- [ ] Replace selection with AI response
- [ ] Preserve formatting in rich mode
- [ ] Update markdown in markdown mode
- [ ] Undo support (restore original selection)

### UX Polish
- [ ] Toolbar follows selection on scroll
- [ ] Tooltip hints for buttons
- [ ] Keyboard shortcuts for quick actions
- [ ] Smooth fade in/out animations
- [ ] Match xnote visual style

### System Prompt
- [ ] Add "inline AI" system prompt to settings
- [ ] Default prompt: "You are helping refine selected text..."
- [ ] Include context about what user selected

---

## Phase 3: Full Chat Sidebar 📋 TODO

### Chat UI Layout
- [ ] Right sidebar design (collapsible)
- [ ] Message list with scroll
- [ ] Input area at bottom
- [ ] Model selector in chat header
- [ ] Close/minimize buttons
- [ ] Resize handle (optional)

### Message Rendering
- [ ] User message bubbles
- [ ] AI message bubbles
- [ ] Markdown rendering for AI messages
- [ ] Code block syntax highlighting
- [ ] Copy button for each message
- [ ] Copy button for code blocks
- [ ] Timestamp display (optional)
- [ ] Message loading indicators

### Chat Functionality
- [ ] Send message to AI
- [ ] Receive streaming responses
- [ ] Display messages in real-time
- [ ] Auto-scroll to latest message
- [ ] Multi-line input support
- [ ] Image paste in chat
- [ ] Maintain conversation context

### Session Management
- [ ] Create new chat session
- [ ] Save chat history to data.json
- [ ] List previous sessions
- [ ] Resume existing session
- [ ] Delete session
- [ ] Session metadata (date, title, message count)
- [ ] Auto-title sessions based on first message

### Chat Sidebar Toggle
- [ ] Keyboard shortcut to open/close chat
- [ ] Button in toolbar to toggle
- [ ] Persist sidebar state (open/closed)
- [ ] Animation when opening/closing
- [ ] Remember width preference

### System Prompt
- [ ] Add "chat" system prompt to settings
- [ ] Default: "You are a helpful AI assistant..."
- [ ] Context: No note content unless explicitly shared

---

## Phase 4: Selection → Chat Integration 📋 TODO

### Selection to Chat Flow
- [ ] Add "Start Chat" button to floating toolbar
- [ ] Click → open chat sidebar
- [ ] Pre-populate chat with selected text as context
- [ ] Show context indicator in chat
- [ ] User can add their question/prompt
- [ ] AI responds with full context

### Context Management
- [ ] Display selected text as "context block" in chat
- [ ] Distinguish context from regular messages
- [ ] Allow removing context
- [ ] Update context if selection changes before sending

### Integration Points
- [ ] Combine Phase 2 toolbar with Phase 3 chat
- [ ] Seamless transition from inline → chat
- [ ] Option to send result back to note
- [ ] "Apply to note" button in chat

### UX Flow
- [ ] Select text in note
- [ ] Toolbar appears with two options:
  - [ ] Quick inline prompt (Phase 2)
  - [ ] Start chat (Phase 4)
- [ ] Choosing chat:
  - [ ] Sidebar opens
  - [ ] Context pre-loaded
  - [ ] User adds question
  - [ ] Conversation continues
  - [ ] Can apply responses to note

---

## Future Enhancements (Post Phase 4) 💡

### Advanced Features
- [ ] Voice input for prompts
- [ ] Export chat as markdown
- [ ] Search within chat history
- [ ] Pin important messages
- [ ] AI-suggested follow-up questions
- [ ] Templates/presets for common tasks
- [ ] Batch processing (multiple selections)

### Performance
- [ ] Cache recent API responses
- [ ] Optimize streaming UI updates
- [ ] Lazy load chat history
- [ ] Debounce selection detection
- [ ] Reduce bundle size

### Settings & Customization
- [ ] Temperature control
- [ ] Max tokens setting
- [ ] Custom quick actions
- [ ] Appearance customization
- [ ] Keyboard shortcut customization

### Data Management
- [ ] Export/import settings
- [ ] Backup chat history
- [ ] Token usage tracking
- [ ] Cost estimation
- [ ] Usage statistics

### Security
- [ ] Encrypt API key in keychain (macOS)
- [ ] Option to exclude sensitive content
- [ ] Local-only mode (no API)
- [ ] Data retention policies

---

## Development Notes

### For Next Session

**Before starting Phase 2:**
1. Read `AI_IMPLEMENTATION_SUMMARY.md` (this phase recap)
2. Review `AI_TODO.md` (this file)
3. Check current codebase structure:
   - `app/main.js:205-300` - AI IPC handlers
   - `app/index.html:1800-2250` - AI JS logic
   - `app/index.html:787-1020` - AI styles
4. Understand existing patterns to reuse:
   - Modal system
   - Floating UI pattern
   - IPC communication
   - Toast notifications
   - Button transformations

**Key Principles:**
- Maintain minimal, professional design
- Smooth animations (0.3s transitions)
- Reuse existing components where possible
- Keep code clean and maintainable
- Test thoroughly before committing

**Testing Approach:**
- Test each feature in isolation
- Verify keyboard shortcuts
- Check both rich and markdown modes
- Test error cases
- Verify animations are smooth

---

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: AI-Assisted Note Drafting | ✅ Done | 100% |
| Phase 2: Inline AI with Toolbar | 🔄 Next | 0% |
| Phase 3: Full Chat Sidebar | 📋 Planned | 0% |
| Phase 4: Selection → Chat | 📋 Planned | 0% |

**Overall Progress:** 25% (1/4 phases complete)

---

**Last Updated:** 2025-11-22
**Branch:** `feature/ai-assisted-note-drafting`
**Ready for:** Phase 2 implementation
