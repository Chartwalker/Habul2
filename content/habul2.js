/** 
 *	HabuL2 namespace
 */
if ("undefined" == typeof(HabuL2)) {
	var HabuL2 = {
		
		debugDump: function(aMessage) {
		  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
										 .getService(Components.interfaces.nsIConsoleService);
		  consoleService.logStringMessage("HabuL2: " + aMessage);
		},
			
		prefserv : Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch),
		
		//L: added for the v8 breakup
		getBoolPref : function(prefName) {
			if (!HabuL2.prefserv.prefHasUserValue(prefName)) {
				HabuL2.prefserv.setBoolPref(prefName, false);
				return false;
			}
			return HabuL2.prefserv.getBoolPref(prefName);
		},

		//L: added by legolas558 for Thunderbird v3 compatibility
		SetNextMessageAfterDelete: function () {
			var treeSelection = GetThreadTree().view.selection;

			if (treeSelection.isSelected(treeSelection.currentIndex)) {
				gNextMessageViewIndexAfterDelete = gDBView.msgToSelectAfterDelete;
				gSelectedIndexWhenDeleting = treeSelection.currentIndex;
			}
			else if (gDBView.removeRowOnMoveOrDelete) {
				// Only set gThreadPaneDeleteOrMoveOccurred to true if the message was
				// truly moved to the trash or deleted, as opposed to an IMAP delete
				// (where it is only "marked as deleted".  This will prevent bug 142065.
				//
				// If it's an IMAP delete, then just set gNextMessageViewIndexAfterDelete
				// to treeSelection.currentIndex (where the outline is at) because nothing
				// was moved or deleted from the folder.
				gThreadPaneDeleteOrMoveOccurred = true;
				gNextMessageViewIndexAfterDelete = treeSelection.currentIndex - NumberOfSelectedMessagesAboveCurrentIndex(treeSelection.currentIndex);
			} else
				gNextMessageViewIndexAfterDelete = treeSelection.currentIndex;
		},

		SendMailTo: function (emailAddress, msgfServer, messages, attachmentURIs) {			
			var msgComposeService = Components.classes["@mozilla.org/messengercompose;1"].getService(Components.interfaces.nsIMsgComposeService);

			var fields = Components.classes["@mozilla.org/messengercompose/composefields;1"].createInstance(Components.interfaces.nsIMsgCompFields),
				params = Components.classes["@mozilla.org/messengercompose/composeparams;1"].createInstance(Components.interfaces.nsIMsgComposeParams);
			if (emailAddress && fields && params) {
				var attachmentURI = "", i, it, attachment;
				for (i = 0, it=attachmentURIs.length; i < it; i++) {
					attachment = Components.classes["@mozilla.org/messengercompose/attachment;1"].createInstance(Components.interfaces.nsIMsgAttachment);
					attachment.url = attachmentURIs[i];
					fields.addAttachment(attachment);
				}

				params.originalMsgURI = attachmentURI;

				fields.to = emailAddress;
				fields.subject = "[HabuL2 Plugin] Spam Report";
				fields.body = msg_okopipiMessageBody.replace("#1", attachmentURIs.length);
				params.type = Components.interfaces.nsIMsgCompType.New; // ForwardAsAttachment or New
				params.format = Components.interfaces.nsIMsgCompFormat.PlainText;
				params.identity = accountManager.getFirstIdentityForServer(msgfServer);
				params.composeFields = fields;

				// dynamically generate a hook with proper parameters
				params.sendListener = {
					sendFailed: false,
					onGetDraftFolderURI: function (folderURI) {},
					onProgress: function (msgID, progress, progressMax) {},
					onSendNotPerformed: function (msgID, status) {
						params.sendListener.sendFailed = true;
						HabuL2.debugDump("send failed");
					},
					onStartSending: function (msgID, msgSize) {},
					onStatus: function (msgID, msg) {},
					
					onStopSending: function (msgID, status, msg, returnFileSpec) {
						//L: delete spam messages only if they were sent successfully
						if (msgID !== null && !params.sendListener.sendFailed) {
							HabuL2.DeleteJunkMail(this.action, this.messages);
						}
					},
					
					// store preference here statically
					action: HabuL2.getAction(),
					
					// all message ids we picked up from the treeview
					messages: messages
				};
				
				
				msgComposeService.OpenComposeWindowWithParams(null, params);
			}

		}, // SendMailTo
		
		//L: added by legolas558 for Thunderbird v3 compatibility
		GetLoadedMsgFolder: function () {
			if (!gDBView) return null;
			return gDBView.msgFolder;
		},

		DeleteJunkMail: function (action, messages) {
			if (1 == action) // delete completely
				HabuL2.deleteJunk(false, messages);
			else if (2 == action)
				HabuL2.deleteJunk(true, messages);

			ClearThreadPaneSelection();
			
			// clear message pane if nothing left
			window.setTimeout(HabuL2.ClearAction, 1);

		}, // DeleteJunkMail
		
		ClearAction: function() {
			var view = gDBView;
			var treeView = view.QueryInterface(Components.interfaces.nsITreeView);
			if (treeView.rowCount == 0) {
				gHaveLoadedMessage = true;
				ClearMessagePane();
			}
		},
		
		deleteJunk: function (trash, messages) {
			var view = gDBView,
				treeView = view.QueryInterface(Components.interfaces.nsITreeView),
				count = treeView.rowCount,
				treeSelection = treeView.selection,
				//L: we will clear selection only once when necessary
				clearedSelection = false,
				// select the junk messages
				messCount = 0, messageUri, msgHdr;
			
			for (var i = 0; i < count; i++) {
				messageUri = view.getURIForViewIndex(i);
				msgHdr = messenger.messageServiceFromURI(messageUri).messageURIToMsgHdr(messageUri);

				// skip this message if it was not previously picked
				if (messages.indexOf(msgHdr.messageId) === -1)
					continue;

				if (!clearedSelection) {
					treeSelection.clearSelection();
					clearedSelection = true;
					treeSelection.selectEventsSuppressed = true;
				}

				++messCount;
				treeSelection.rangedSelect(i, i, true /* augment */ );
			}

			//L: there was no junk so mission ends here
			if (!clearedSelection) return;

			// restore user selection
			treeSelection.selectEventsSuppressed = false;

			// should we try to set next message after delete
			// to the message selected before we did all this, if it was not junk?
			HabuL2.SetNextMessageAfterDelete();

			// send the delete command (DANGEROUS! can delete something selected by user meanwhile)
			view.doCommand(trash ? nsMsgViewCommandType.deleteMsg : nsMsgViewCommandType.deleteNoTrash);
		}, // deleteJunk

		//L: called from messenger.xul
		ReportJunk: function (event) {
		
			//L: added by legolas558 for Thunderbird v3 compatibility
			var msgf = HabuL2.GetLoadedMsgFolder();
			// if there's no active folder, can't report
			if (msgf === null) return;

			//RFC
			MsgJunkMailInfo(true);
			var view = gDBView;

			// need to expand all threads, so we find everything
			view.doCommand(nsMsgViewCommandType.expandAll);

			var treeView = view.QueryInterface(Components.interfaces.nsITreeView),
				count = treeView.rowCount;

			if (count == 0)
				return;

			var messages = [];
					
			var	treeSelection = treeView.selection,
				attachmentURIs = [],
				maxJunkToPick = HabuL2.getMaxJunkToPick();

			// select the junk messages
			for (var i = 0; i < count; i++) {
				var messageUri = view.getURIForViewIndex(i);
				var msgHdr = messenger.messageServiceFromURI(messageUri).messageURIToMsgHdr(messageUri);
				var junkScore = msgHdr.getStringProperty("junkscore");
				var isJunk = ((junkScore != "") && (junkScore != "0"));
				
				// if the message is junk, pick it.
				if (isJunk) {
					attachmentURIs.push(messageUri);
					messages.push(msgHdr.messageId);
					
					// we collect only a certain amount of junk
					if (messages.length == maxJunkToPick)
						break;
				}
			}

			if (0 == attachmentURIs.length) {
				alert(msg_okopipiNoJunk);
			} else {
				// open the composer window
				HabuL2.SendMailTo(HabuL2.getRecipients(), msgf.server, messages, attachmentURIs);
			}
			
		}, // ReportJunk
		
		getRecipients: function() {
				var prefID = "habul2.okspamcop", okuserid;
				if (HabuL2.getBoolPref(prefID) == true) {
					prefID = "habul2.okuserid";
					if (HabuL2.prefserv.prefHasUserValue(prefID)) {
						okuserid = HabuL2.prefserv.getCharPref(prefID);
					} else {
						okuserid = prompt(msg_okopipiIdPrompt);
						HabuL2.prefserv.setCharPref(prefID, okuserid);
					}

					prefID = "habul2.quickspamcop";
					if (HabuL2.getBoolPref(prefID) == true) {
						okuserid = "quick." + okuserid + "@spam.spamcop.net";
					} else {
						okuserid = "submit." + okuserid + "@spam.spamcop.net";
					}
				} else {
					okuserid = "";
				}

				prefID = "habul2.okcustid";
				var okcustid;
				if (HabuL2.prefserv.prefHasUserValue(prefID)) {
					okcustid = HabuL2.prefserv.getCharPref(prefID);
				} else {
					okcustid = prompt(msg_okopipicIdPrompt);
					HabuL2.prefserv.setCharPref(prefID, okcustid);
				}

				prefID = "habul2.knujonreports";
				var knujonuserId, knujonreports;
				if (HabuL2.getBoolPref(prefID) == true) {
					prefID = "habul2.knujonuserId";
					if (HabuL2.prefserv.prefHasUserValue(prefID)) {
						knujonuserId = HabuL2.prefserv.getCharPref(prefID);
					} else {
						knujonuserId = "nonreg";
					}
					knujonreports = knujonuserId + "@knujon.net";
				} else {
					knujonreports = "";
				}

				var okftc, okfda, usareports;
				prefID = "habul2.usareports";
				if (HabuL2.getBoolPref(prefID) == true) {
					prefID = "habul2.ftcreports";
					if (HabuL2.getBoolPref(prefID) == true) okftc = "spam@uce.gov";
					else okftc = "";

					prefID = "habul2.fdareports";
					if (HabuL2.getBoolPref(prefID) == true) okfda = "webcomplaints@ora.fda.gov";
					else okfda = "";

					usareports = okftc + "," + okfda;
				} else {
					usareports = "";
				}

				prefID = "habul2.aureports";
				var okacmaId, aureports;
				if (HabuL2.getBoolPref(prefID) == true) {
					prefID = "habul2.okacmaId";
					if (HabuL2.prefserv.prefHasUserValue(prefID))
						okacmaId = HabuL2.prefserv.getCharPref(prefID);
					else okacmaId = "anonymous";
					aureports = okacmaId + "@submit.spam.acma.gov.au";
				} else {
					aureports = "";
				}

				var okmailto = okuserid + "," + okcustid + "," + usareports + "," + aureports + "," + knujonreports;
			
			return okmailto;
		},

		// can be 1 or 2 depending on whether junk mail gets deleted or moved to trash
		getAction: function() {
			var prefID = "habul2.action";
			return HabuL2.prefserv.prefHasUserValue(prefID) ? HabuL2.prefserv.getIntPref(prefID) : 2;
		},

		// maximum amount of junk to pick
		getMaxJunkToPick: function() {
			var prefID = "habul2.maxJunkToPick";
			return HabuL2.prefserv.prefHasUserValue(prefID) ? HabuL2.prefserv.getIntPref(prefID) : 500;
		}

	}; // HabuL2
}
