/*
 * Network Topology configuration tool
 */

var network;

var networkJson;

function status_msg (s) {
    var status = $("#status")
    status.html(s)
}

function status_msg_append (s) {
    var status = $("#status")
    var oldVal = status.html()

    status.html(oldVal + "<br>" + s)
}

/*
 * Keeps an monoatomically increasing count of networkIDs
 * eg, private1...private100
 */
var networkID = 0;
function nextNetworkID () {
    networkID++;
    return networkID;
}
function setNextNetworkID (id) {
    networkID = id
}

/*
 * Keeps an monoatomically increasing count of vmIDs
 * eg, r1..r100
 */
var vmID = 0;
function nextVMID () {
    vmID++;
    return vmID;
}
function setNextVMID (id) {
    vmID = id;
}

// convenience method to stringify a JSON object
function toJSON (obj) {
    return JSON.stringify(obj, null, 4);
}

function updateVmmJson (nodes, edges) {
    networkJson = [];
    o = networkJson

    function get_other_id (self, edge) {
	if (edge.to == self) {
	    return edge.from;
	} else {
	    return edge.to;
	}
    }
    
    function get_link_to (self, nodes) {
	var link_tos = []

	$.each(nodes, function (k, v) {
	    if (v.to == self.id)
		link_tos.push(v.from)
	    else
		link_tos.push(v.to)
	});

	return link_tos;
    }

    nodes.map(function (item, id) {
	var e = edges.get({
	    filter: function (item) {
		return item.from == id || item.to == id;
	    }
	});

        var r = {};

        r.name = item.label;
	r.id = item.id;
        r.basedisk = $("#basedisk").val();
        r.install = "/homes/wing/vmm/jmx.junos.conf";
	r.links = get_link_to(item, e);
        r.interfaces = []

	var emIdx = 0;
	var intf = {}
	intf.name = "em" + emIdx;
	intf.type = "external";
	intf.nic_no = emIdx;
	r.interfaces.push(intf);
	emIdx++;

	$.each(e, function(k, v) {
            var intf = {}

	    intf.name = "em" + emIdx;
	    intf.nic_no = emIdx;
	    intf.type = "private" + v.networkID;
	    intf.net_no = v.networkID;
	    if (v.from == r.id) {
		intf.link_to_id = v.to
	    } else {
		intf.link_from_id = v.from
	    }
	    
	    r.interfaces.push(intf)

	    emIdx++;
	});

	var cmds = []


        var emIdx = 1;
	$.each(e, function(k, v) {
	    cmds.push('set interfaces em' + emIdx +
		      '.0 family inet address 10.0.' + v.networkID + '.' + id + '/24')
	    emIdx++;
        });

	r.set_commands = cmds;

	o.push(r);
    })

    var txt = toJSON(o)

    networkJson = o
    $("#vmm-json").html(txt)
    updateDownloadRef(networkJson)
}

function mkPrivateNetwork(id) {
    return "10.0." + String(id) + ".0/24\nprivate" + id;
}

function updateDownloadRef(obj) {
    var data = "text/json;charset=utf-8," + encodeURIComponent(toJSON(obj))
    var a = $("#download")

    a.attr("href", 'data:' + data)
    a.attr("download", 'vmm.json')
}

function loadTopology (topo) {
    var nodes, edges;

    if (network) {
	network.destroy();
	delete network;
    }

    // create an array with nodes
    nodes = new vis.DataSet();

    var maxID = 0;

    $.each(topo, function(k, n) {
	var id = parseInt(n.id)
	nodes.add({
	    id: id,
	    label: n.name
	});

	if (id > maxID) {
	    maxID = id;
	}
    });

    setNextVMID(maxID);

    // create an array with edges
    edges = new vis.DataSet();

    maxID = 0;
    $.each(topo, function(k, n) {
	var fromId = n.id;
	$.each(n.interfaces, function(k, interface) {
	    if (k > 0 && interface.link_to_id) {
		var toId = interface.link_to_id;
		var edgeId;

		edgeId = interface.net_no;

		edges.add({
		    id: edgeId,
		    from: fromId,
		    to: toId,
		    networkID: interface.net_no
		});
		if (interface.net_no > maxID) {
		    maxID = interface.net_no;
		}
	    }
	});
    });
    setNextNetworkID(maxID);

    edges.map(function(item, id) {
	item.label = mkPrivateNetwork(id);
	item.labelAlignment = "line-above";
	edges.update(item);
    })

    nodes.subscribe('*', function () {
	updateVmmJson(nodes, edges);
    });

    edges.subscribe('*', function () {
	updateVmmJson(nodes, edges);
    });

    // create a network
    var container = $('#network').get(0);
    var data = {
        nodes: nodes,
        edges: edges
    };
    var options = {
	hover: true,
	dataManipulation: true,
        configurePhysics: false,
	physics: {
	    barnesHut: {
		centralGravity: 0.1,
		gravitationalConstant: -3250,
		springLength: 125,
		sprintConstant: 0.0386
	    }
	},

	onAdd: function (data, callback) {
	    var newData = data;
	    newData.id = nextVMID();
	    newData.label = "r" + String(newData.id);
	    callback(newData);
	},

	onEditEdge: function (data, callback) {
	    var newData = data;
	    newData.networkID = nextNetworkID();

	    callback(newData)
	},

	onConnect: function (data, callback) {
	    var newData = data;
	    newData.networkID = nextNetworkID();
	    newData.label = mkPrivateNetwork(newData.networkID);
	    newData.id = newData.networkID;
	    callback(newData)
	},

    };
    network = new vis.Network(container, data, options);

    network.on('select', function networkSelect (properties) {

	if (properties.nodes.length > 0) {
	    var id = properties.nodes[0]
	    var label = nodes.get(id)

	    status_msg("Node id: " + String(id))
	    status_msg_append("Node label: " + String(label.label))
	} else {
	    var id = properties.edges[0]
	    var e = edges.get(id)

	    var label;
	    if (e.label) label = e.label; else label = ""

	    status_msg("Edge id: " + String(id))
	    status_msg_append("Node label: " + String(label))

	    $('#edge-id').val(id);
	    $('#edge-label').val(label);
	    $('#edge-from').val(e.from);
	    $('#edge-to').val(e.to);
	}
    });

    // Initial update of rendered text
    updateVmmJson(nodes, edges);
}

$(window).load(function () {

    $('#upload_vmm').click(function(x) {
	$("#LoadJson").click();
    });


    // Handle loading of json file
    $('#LoadJson').change(function (evt) {
	var files = evt.target.files;
	var output = [];
	for (var i = 0, f; f = files[i]; i++) {
	    output.push(escape(f.name), f.size, f.lasModifiedDate);
	    console.log(f)

	    var reader = new FileReader();

	    reader.onload = (function(theFile) {
		return function (e) {
		    console.log(e)
		    var s = e.target.result
		    var vmmObj = $.parseJSON(s)
		    loadTopology(vmmObj)
		    console.log(vmmObj)
		};
	    })(f);

	    reader.readAsText(f)
	}
	console.log(output.join(' '))
    })

    initialTopology = [ {
        "name": "r1",
        "id": 1,
        "interfaces": [
            {
                "name": "em0",
                "type": "external",
                "nic_no": 0
            },
            {
                "name": "em1",
                "nic_no": 1,
                "type": "private1",
                "net_no": 1,
                "link_to_id": 2
            },
        ],
    }, {
        "name": "r2",
        "id": 2,
        "interfaces": [
            {
                "name": "em0",
                "type": "external",
                "nic_no": 0
            },
        ],
    }]

    loadTopology(initialTopology)
});
