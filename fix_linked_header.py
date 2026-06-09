import re

filepath = r"D:\Downloads\Property Manager\frontend\src\app\dashboard\owner\properties\page.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Get the exact text from lines 1708-1795 (0-indexed: 1707-1794)
lines = content.split('\n')

# Extract the old header
old_lines = lines[1707:1795]  # 1708 to 1795 (exclusive of 1795)
old_linked = '\n'.join(old_lines)

# Create the new gradient header
new_linked = """              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
                <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
                <div className="relative p-6 md:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => {
                        setCurrentView('properties');
                        setSelectedProperty(null);
                      }}
                      className="group relative w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 backdrop-blur-sm border border-white/20"
                    >
                      <ArrowLeft className="relative z-10 w-5 h-5 text-white transition-colors duration-300" />
                    </button>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Occupant Management</span>
                      <h2 className="text-2xl font-black tracking-tight mt-0.5">Room {selectedRoom.roomNumber} - Occupants</h2>
                      <p className="text-sm text-white/80 mt-0.5">View and manage occupants assigned to this unit.</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-white/60" />
                      <input
                        type="text"
                        placeholder="Search occupant name..."
                        value={linkedUserSearchQuery}
                        onChange={(e) => setLinkedUserSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 outline-none"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const vacantBeds = roomBeds.filter((b: any) => !b.isOccupied);
                        if (vacantBeds.length === 0) {
                          showToast('No vacant beds available in this room.', 'error');
                          return;
                        }
                        const firstVacantBed = vacantBeds[0];
                        setAssigningContext({
                          propertyId: selectedProperty._id,
                          propertyName: selectedProperty.propertyName,
                          roomId: selectedRoom._id,
                          roomNumber: selectedRoom.roomNumber,
                          bedId: firstVacantBed._id,
                          bedNumber: firstVacantBed.bedNumber
                        });
                        setSelectedTenantToAssign('');
                        setAssignMode('existing');
                        fetchUnassignedTenants();
                        setIsAssignModalOpen(true);
                      }}
                      disabled={roomBeds.every((b: any) => b.isOccupied)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all shadow-md backdrop-blur-sm border border-white/20 shrink-0 disabled:opacity-50 disabled:scale-100"
                    >
                      <Plus className="w-4 h-4" />
                      Assign Tenant
                    </button>
                  </div>
                </div>
              </div>"""

if old_linked in content:
    content = content.replace(old_linked, new_linked, 1)
    print(f"> Linked users header gradient banner applied!")
    print(f"  Matched {len(old_linked)} chars")
else:
    print(f"! Pattern not found in content")
    print(f"  First 200 chars of pattern: {repr(old_linked[:200])}")
    # Find similar pattern
    idx = content.find('flex flex-col sm:flex-row justify-between items-start')
    if idx > 0:
        context = content[idx:idx+3000]
        print(f"  Found similar pattern at {idx}")
        print(f"  Context: {context[:200]}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDone!")
