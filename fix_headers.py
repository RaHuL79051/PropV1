import re

filepath = r"D:\Downloads\Property Manager\frontend\src\app\dashboard\owner\properties\page.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# === ROOM VIEW HEADER ===
old_room = """              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setCurrentView('properties');
                      setSelectedProperty(null);
                    }}
                    className="
                      group relative
                      w-10 h-10 rounded-full
                      border border-slate-200 dark:border-slate-800
                      flex items-center justify-center
                      overflow-hidden
                      cursor-pointer
                      transition-all duration-300 ease-out
                      hover:scale-105
                      hover:shadow-lg
                    "
                  >
                    {/* Animated Background Fill */}
                    <span
                      className="
                        absolute inset-0
                        bg-primary
                        scale-0
                        rounded-full
                        transition-transform duration-300 ease-out
                        group-hover:scale-100
                      "
                    ></span>

                    {/* Arrow Icon */}
                    <ArrowLeft
                      className="
                        relative z-10
                        w-5 h-5
                        text-slate-500
                        transition-colors duration-300
                        group-hover:text-white
                      "
                    />
                  </button>
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{selectedProperty.propertyName} - Rooms</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage all room allocations and statuses for this property.</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-455" />
                    <input
                      type="text"
                      placeholder="Search room number or tenant..."
                      value={roomSearchQuery}
                      onChange={(e) => setRoomSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <button
                    onClick={() => { setSelectedPropertyId(selectedProperty._id); setIsAddRoomModalOpen(true); }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Add Room
                  </button>
                </div>
              </div>"""

new_room = """              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-600 via-primary to-blue-600 text-white shadow-xl">
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
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Room Management</span>
                      <h2 className="text-2xl font-black tracking-tight mt-0.5">{selectedProperty.propertyName} - Rooms</h2>
                      <p className="text-sm text-white/80 mt-0.5">Manage all room allocations and statuses for this property.</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-white/60" />
                      <input
                        type="text"
                        placeholder="Search room number or tenant..."
                        value={roomSearchQuery}
                        onChange={(e) => setRoomSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 outline-none"
                      />
                    </div>
                    <button
                      onClick={() => { setSelectedPropertyId(selectedProperty._id); setIsAddRoomModalOpen(true); }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all shadow-md backdrop-blur-sm border border-white/20 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      Add Room
                    </button>
                  </div>
                </div>
              </div>"""

if old_room in content:
    content = content.replace(old_room, new_room, 1)
    changes += 1
    print("> Room view header gradient banner applied")
else:
    print("! Room view header - pattern not found")
    # Print first 100 chars of room header section for debugging
    idx = content.find('flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4')
    if idx > 0:
        print(f"  Found at position {idx}")
        print(f"  Context: {content[idx:idx+200]}")

# === LINKED USERS VIEW HEADER ===
old_linked = """              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setCurrentView('properties');
                      setSelectedProperty(null);
                    }}
                    className="
                      group relative
                      w-10 h-10 rounded-full
                      border border-slate-200 dark:border-slate-800
                      flex items-center justify-center
                      overflow-hidden
                      cursor-pointer
                      transition-all duration-300 ease-out
                      hover:scale-105
                      hover:shadow-lg
                    "
                  >
                    <span
                      className="
                        absolute inset-0
                        bg-primary
                        scale-0
                        rounded-full
                        transition-transform duration-300 ease-out
                        group-hover:scale-100
                      "
                    ></span>

                    <ArrowLeft
                      className="
                        relative z-10
                        w-5 h-5
                        text-slate-500
                        transition-colors duration-300
                        group-hover:text-white
                      "
                    />
                  </button>
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Room {selectedRoom.roomNumber} - Occupants</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">View and manage occupants assigned to this unit.</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-455" />
                    <input
                      type="text"
                      placeholder="Search occupant name..."
                      value={linkedUserSearchQuery}
                      onChange={(e) => setLinkedUserSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
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
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 shrink-0 disabled:opacity-50 disabled:scale-100"
                  >
                    <Plus className="w-4 h-4" />
                    Assign Tenant
                  </button>
                </div>
              </div>"""

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
    changes += 1
    print("> Linked users header gradient banner applied")
else:
    print("! Linked users header - pattern not found")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n{'='*40}")
print(f"Total changes applied: {changes}")
print(f"{'='*40}")
