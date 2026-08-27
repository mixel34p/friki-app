const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

// First remove them from the layout block
app = app.replace('            <Route path="/lists/new" element={<ProtectedRoute><CreateList /></ProtectedRoute>} />\n', '');
app = app.replace('            <Route path="/lists/:id/edit" element={<ProtectedRoute><CreateList /></ProtectedRoute>} />\n', '');

// Now add them before the layout block (around where chat is)
app = app.replace('          {/* Protected routes with Layout */}', 
    '          {/* Editor Routes (No Layout) */}\n' +
    '          <Route path="/lists/new" element={<ProtectedRoute><CreateList /></ProtectedRoute>} />\n' +
    '          <Route path="/lists/:id/edit" element={<ProtectedRoute><CreateList /></ProtectedRoute>} />\n\n' +
    '          {/* Protected routes with Layout */}');

fs.writeFileSync('src/App.jsx', app);
