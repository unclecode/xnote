# xnote AI Features - Implementation Roadmap

**Current Phase:** ✅ Phase 1, 1.5, and 3 Complete
**Next Phase:** Bug Fixes & Phase 4

---

## IMMEDIATE NEXT TASKS (Priority)

### Issue 1: Image Generation Not Showing Actual Images
**Problem:** API returning text descriptions instead of actual images
**Status:** 🔴 Critical Bug
**Details:**
- Backend config has `responseModalities: ['IMAGE']` and `imageConfig`
- Response contains text descriptions like "a photo of..." instead of image data
- Need to debug Gemini API response parsing
- Verify correct API parameters and response handling
- Check if images are in response but not being extracted properly

### Issue 2: Floating Mode Missing Note Context for Images
**Problem:** When generating images via Cmd+Y, note content not sent as context
**Status:** 🟡 Enhancement Needed
**Details:**
- User wants to generate images relevant to their note content
- Example: "create a blog post image for this note"
- Need to verify if note content is being sent with image generation requests
- If missing, add note context to floating mode image generation
- Should work like text generation (includes note content)

### Issue 3: Need Insert vs Replace Mode Selector
**Problem:** No way to choose between replacing entire note or inserting at cursor
**Status:** 🟡 Enhancement Needed
**Details:**
- Current behavior: Floating mode replaces entire note (or selection if present)
- Needed: Checkbox or toggle in floating UI to choose:
  - [ ] "Replace entire note" (current default)
  - [ ] "Insert at cursor position" (needed for images and incremental edits)
- Should be persistent (remember user preference)
- Particularly important for image insertion
- Should work in both rich and markdown modes

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

## Phase 1.5: Selection-Aware AI Transformation ✅ DONE

### Selection Detection
- [x] Detect text selection in rich editor
- [x] Detect text selection in markdown editor
- [x] Smart behavior: replace selection OR entire note
- [x] Handle selection in both editing modes

### Context Card UI
- [x] WhatsApp-style context card
- [x] Show selected text preview (truncated to 100 chars)
- [x] Remove button (X) to dismiss context
- [x] Display:none when hidden (no ghost spacing)
- [x] Positioned above prompt textarea

### Replacement Logic
- [x] Send selection + prompt to AI when text selected
- [x] Replace only selection (preserve rest of note)
- [x] Replace entire note when no selection
- [x] Maintain cursor position after replacement
- [x] Work in both HTML (rich) and markdown modes

### Visual Feedback
- [x] Context card shows what will be transformed
- [x] User control via remove button
- [x] Smooth animations and transitions

**Commit:** a4acc30, 02f1527

---

## Phase 2: Inline AI with Floating Toolbar 📋 SKIPPED

**Reason:** Phase 1.5 already provides selection-aware transformation functionality via Cmd+Y. A separate floating toolbar would be redundant and add UI complexity without significant value.

**Alternative:** Phase 1.5's approach (context card in floating UI) is cleaner and more consistent with xnote's minimal design philosophy.

---

## Phase 3: Full Chat Sidebar ✅ DONE

### Chat UI Layout
- [x] Right sidebar design (400px, non-overlay)
- [x] Message list with scroll
- [x] Input area at bottom (fixed position)
- [x] Model selector in chat header
- [x] Close button (X)
- [x] Pushes main content left (not floating)

### Message Rendering
- [x] User message bubbles (blue, right-aligned)
- [x] AI message bubbles (gray, left-aligned)
- [x] Markdown rendering for AI messages (marked.js)
- [x] Code block syntax highlighting (highlight.js)
- [x] Copy button for each message
- [x] "Add to note" button for each message
- [x] Proper formatting preservation
- [x] Message loading indicators (thinking animation)

### Chat Functionality
- [x] Send message to AI
- [x] Receive streaming responses
- [x] Display messages in real-time
- [x] Auto-scroll to latest message
- [x] Multi-line input support (Shift+Enter)
- [x] Image paste in chat (Cmd+V with thumbnails)
- [x] Maintain conversation context across messages

### Selection & Context Management
- [x] Smart selection monitoring (300ms polling)
- [x] Auto-detect selection while chat open
- [x] Show selection in context card with remove button
- [x] "Include current note" checkbox
- [x] Visual indicators for all context types
- [x] Works in both rich and markdown modes

### Session Management
- [x] Create new chat session
- [x] Save chat history to data.json (auto-save)
- [x] List previous sessions with dates
- [x] Resume existing session (restore full state)
- [x] Delete session option
- [x] Session metadata (id, title, created, modified)
- [x] Auto-title sessions based on first message
- [x] Unlimited chat history

### Chat Sidebar Toggle
- [x] Keyboard shortcut (Cmd+Shift+Y)
- [x] Button in toolbar to toggle
- [x] Smooth animation when opening/closing
- [x] Distinct from floating input (Cmd+Y)

### Image Support
- [x] Paste images in chat input
- [x] Image thumbnails with remove buttons
- [x] Display images in AI responses
- [x] Download, Open, Add to note buttons for images

### Model Integration
- [x] Model selector with actual Gemini names
- [x] Per-session model memory
- [x] Visual consistency with main app
- [x] Support for image generation model

**Commits:** 02f1527, 8dc3e62, de4b514, 77a8f84

---

## Image Generation Feature ✅ DONE (with bugs)

### Model Integration
- [x] Add gemini-3-pro-image-preview to all selectors
- [x] Backend config: responseModalities, imageConfig
- [x] Google Search toggle in settings
- [x] Tools configuration for search retrieval

### UI Components
- [x] Thinking animation with animated dots
- [x] Image display in chat with action buttons
- [x] Image insertion in floating mode at cursor
- [x] Download, Open, Add to note functionality
- [x] Lucide icons integration

### Known Issues
- [ ] **Images not generating properly** (returning text instead)
- [ ] **Missing note context in floating mode for images**
- [ ] **Need insert vs replace mode selector**

**Commits:** 8dc3e62, de4b514, 77a8f84

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
| Phase 1.5: Selection-Aware Transformation | ✅ Done | 100% |
| Phase 2: Inline AI with Toolbar | ⏭️ Skipped | N/A |
| Phase 3: Full Chat Sidebar | ✅ Done | 100% |
| Image Generation Feature | ✅ Done | 90% (3 bugs) |
| Phase 4: Selection → Chat | 📋 Planned | 0% |

**Overall Progress:** 75% (3/4 phases complete, 1 skipped)

**Immediate Priority:** Fix 3 critical bugs in image generation and floating mode

---

**Last Updated:** 2025-11-22
**Branch:** `feature/ai-assisted-note-drafting`
**Ready for:** Bug fixes, then Phase 4 implementation

**Recent Commits:**
- a4acc30: Phase 1.5 selection-aware transformation
- 02f1527: Phase 1.5 + Phase 3 complete implementation
- 8dc3e62: Image generation partial
- de4b514: Image generation complete
- 77a8f84: Image generation bug fixes (still has issues)
