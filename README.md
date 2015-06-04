# topo-manager
Network Topology Manager

A simple visual editor for creating a network topology. The JSON output is used to configure VMs in Virtual Box.


To run, start the Flask python web server by running. 

<pre>
./startme
</pre>

Note: you may need to install flask via 'pip'

<pre>
sudo pip install flask
</pre>

Then point your browser to 

<pre>
http://localhost:8000/config_vmm.html
</pre>


Play with the graph and when happy save the JSON configuration file by
clicking on the 'Download' tab. 

More soon, scripts to use the JSON configuration to spin up Devices.
