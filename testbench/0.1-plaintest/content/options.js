/** 
 *	HabuL2Options namespace
 */
if ("undefined" == typeof(HabuL2Options)) {
	var HabuL2Options = {

		_elementIDs: ["okuserid", "action", "okcustid", "ftcreports", "okspamcop", "quickspamcop", "fdareports", "aureports", "usareports", "okacmaId", "knujonreports", "knujonuserId"],

		prefserv : Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch),
		
		//L: added for the v8 breakup
		getBoolPref : function(prefName) {
			if (!HabuL2Options.prefserv.prefHasUserValue(prefName)) {
				HabuL2Options.prefserv.setBoolPref(prefName, false);
				return false;
			}
			return HabuL2Options.prefserv.getBoolPref(prefName);
		},
		
		initOptions: function () {
			var element, eltType;

			// initialize the default window values...
			for (var i = 0, it = HabuL2Options._elementIDs.length; i < it; i++) {
					element = document.getElementById(HabuL2Options._elementIDs[i]);
					if (!element) break;
					eltType = element.localName;
					try {
						if (eltType == "radiogroup") element.selectedIndex = HabuL2Options.prefserv.getIntPref(element.getAttribute("prefstring"))
						else if (eltType == "checkbox") element.checked = HabuL2Options.getBoolPref(element.getAttribute("prefstring"));
						else if (eltType == "textbox") element.value = Habu2LOptions.prefserv.getCharPref(element.getAttribute("prefstring"));
					} catch (ex) {}
				}
		},	// initOptions
		
		savePrefs: function () {
			var element, eltType;

			for (var i = 0, it = HabuL2Options._elementIDs.length; i < it; i++) {
					element = document.getElementById(HabuL2Options._elementIDs[i]);
					if (!element) break;
					eltType = element.localName;

					if (eltType == "radiogroup") HabuL2Options.prefserv.setIntPref(element.getAttribute("prefstring"), element.selectedIndex);
					else if (eltType == "checkbox") HabuL2Options.prefserv.setBoolPref(element.getAttribute("prefstring"), element.checked);
					else if (eltType == "textbox" && element.preftype == "int") HabuL2Options.prefserv.setIntPref(element.getAttribute("prefstring"), parseInt(element.value));
					else if (eltType == "textbox") HabuL2Options.prefserv.setCharPref(element.getAttribute("prefstring"), element.value);
				}
		} // savePrefs

	}; // HabuL2Options
}
