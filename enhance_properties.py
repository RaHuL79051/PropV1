import re

filepath = r"D:\Downloads\Property Manager\frontend\src\app\dashboard\owner\properties\page.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# 1. Loading state - enhance with skeleton
old = '<Loader2 className="w-8 h-8 animate-spin text-primary" />'
new = '''<div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
          <div className="space-y-2 text-center">
            <div className="skeleton h-4 w-32 mx-auto" />
            <div className="skeleton h-3 w-48 mx-auto" />
          </div>
        </div>'''
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print(f"> Loading state enhanced")
else:
    print("! Loading state - pattern not found")

# 2. Main container - add animate-stagger
old = '<div className="space-y-6 pb-12">'
new = '<div className="space-y-6 pb-12 animate-stagger">'
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print(f"> animate-stagger added to main container")
else:
    print("! Main container - pattern not found")

# 3. Properties view header - gradient banner
old = """          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">My Properties</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Manage real estate listings, rooms, and rent amounts.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-450" />
                <input
                  type="text"
                  placeholder="Search properties..."
                  value={propertySearchQuery}
                  onChange={(e) => setPropertySearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md shadow-primary/20 transition-all hover:scale-105 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add Property
              </button>
            </div>
          </div>"""

new = """          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary via-indigo-600 to-blue-700 text-white shadow-xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
            <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
            <div className="relative p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Real Estate Portfolio</span>
                <h2 className="text-2xl font-black tracking-tight mt-1">My Properties</h2>
                <p className="text-sm text-white/80 mt-1">Manage real estate listings, rooms, and rent amounts.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-white/60" />
                  <input
                    type="text"
                    placeholder="Search properties..."
                    value={propertySearchQuery}
                    onChange={(e) => setPropertySearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 outline-none"
                  />
                </div>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-bold shadow-lg backdrop-blur-sm border border-white/20 transition-all hover:scale-105 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Add Property
                </button>
              </div>
            </div>
          </div>"""
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print(f"> Properties header gradient banner applied")
else:
    print("! Properties header - pattern not found")

# 4. Property empty state - card-hover + icon bg
old = """            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Building className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Properties Registered</h3>"""
new = """            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm card-hover">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Building className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Properties Registered</h3>"""
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print(f"> Property empty state enhanced")
else:
    print("! Property empty state - pattern not found")

# 5. Desktop properties table - add card-hover
old = '<div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">\n                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 font-sans">'
new = '<div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden card-hover">\n                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 font-sans">'
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print(f"> Desktop properties table - card-hover added")
else:
    print("! Desktop properties table - pattern not found")

# 6. Mobile property cards - add card-hover
old = 'className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 cursor-pointer hover:border-primary/50 transition-colors"'
new = 'className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 cursor-pointer hover:border-primary/50 transition-colors card-hover"'
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print(f"> Mobile property cards - card-hover added")
else:
    print("! Mobile property cards - pattern not found")

# 7. Room view analytics cards - add card-hover (3 instances)
old1 = '<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-start justify-between">'
new1 = '<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-start justify-between card-hover">'
count = content.count(old1)
if count > 0:
    content = content.replace(old1, new1, 3)
    changes += 1
    print(f"> {min(count, 3)} analytics cards - card-hover added")
else:
    print("! Analytics cards - pattern not found")

# 8. Room table header - card-hover
old = '<div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">\n              <div className="p-4 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center bg-slate-50 dark:bg-slate-950">'
new = '<div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden card-hover">\n              <div className="p-4 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center bg-slate-50 dark:bg-slate-950">'
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print(f"> Room table - card-hover added")
else:
    print("! Room table - pattern not found")

# 9. Linked users table - card-hover
old = '<div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width: 1250 }}>'
new = '<div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden card-hover" style={{ width: 1250 }}>'
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print(f"> Linked users table - card-hover added")
else:
    print("! Linked users table - pattern not found")

# 10. Room view breadcrumbs header - enhance
old = """              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
new = """              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-600 via-primary to-blue-600 text-white shadow-xl">
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
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print(f"> Room view header - gradient banner applied")
else:
    print("! Room view header - pattern not found")

# 11. Linked users view header - enhance
old = """              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
new = """              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-xl">
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
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print(f"> Linked users header - gradient banner applied")
else:
    print("! Linked users header - pattern not found")

# 12. Tenant Licensing Banner - card-hover
old = '<div className="p-6 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">'
new = '<div className="p-6 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 card-hover">'
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print(f"> Licensing banner - card-hover added")
else:
    print("! Licensing banner - pattern not found")

# 13. Flat lease agreement card - card-hover
old = '<div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">'
new = '<div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 card-hover">'
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print(f"> Flat lease agreement card - card-hover added")
else:
    print("! Flat lease agreement card - pattern not found")

# 14. Search empty state for properties - card-hover
old = '<div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">\n                  <Search className="w-10 h-10 mx-auto text-slate-400 mb-3 animate-pulse" />'
new = '<div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm card-hover">\n                  <Search className="w-10 h-10 mx-auto text-slate-400 mb-3 animate-pulse" />'
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print(f"> Search empty state - card-hover added")
else:
    print("! Search empty state - pattern not found")

# Write the modified content back
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n{'='*40}")
print(f"Total changes applied: {changes}")
print(f"{'='*40}")
