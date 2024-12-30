// SDK Virtual Climate Driver
// Copyright 2017 Remote Technologies Inc.

var g_debug = Config.Get("DebugTrace") == "true";

var g_InitializeTimer = new Timer();
var g_Stat_Count = 0;
var g_Stat_Names = new Array();
var g_Stats = new Array();
var g_Stat_Handle_Map = new Array();
var g_TempTimer_Handle_Map = new Array();
var g_Temp_Scale = parseInt((Config.Get("Scale")),10);

var g_local_time_in_seconds = System.GetLocalTimeInSeconds();
var g_utc_time_in_seconds = System.GetUTCTimeInSeconds();
var g_timeDif;
if (g_local_time_in_seconds > g_utc_time_in_seconds)
{
	g_timeDif = ((g_local_time_in_seconds-g_utc_time_in_seconds)*1);							
}
else
{
	g_timeDif = ((g_utc_time_in_seconds-g_local_time_in_seconds)*(-1));						
}

var g_timeShift = ((((parseInt((System.GetUTCTimeInSeconds()),10))+(g_timeDif))*1000));
var g_time = new Date(g_timeShift);
var g_hours = g_time.getUTCHours();
var g_month = g_time.getUTCMonth();

System.Print("SDK Virtual Climate: Initializing \r\n");

for (var i = 1; i <= 6; i++)
{
	g_Stat_Names[i] = Config.Get("StatName"+(padDigits(i,3))).toString();
	if(g_Stat_Names[i].length > 0)
	{
		g_Stats[i] = new StatObj(i);
		g_Stat_Count++;
	}
	else
	{
		break;
	}
}

if (g_debug) 
{
	System.Print("SDK Virtual Climate: g_Temp_Scale = "+g_Temp_Scale);
	System.Print("SDK Virtual Climate: g_Stat_Count = "+g_Stat_Count);
	System.Print("SDK Virtual Climate: g_hours = "+g_hours);
	System.Print("SDK Virtual Climate: g_month = "+g_month);
}

g_InitializeTimer.Stop();
g_InitializeTimer.Start(StartInitialization,5000);

function StartInitialization()
{
	g_InitializeTimer.Stop();
	for (var i = 1; i <= g_Stat_Count;)
	{
		InitializationChange(i,2);
		TempScaleChange(i, g_Stats[i].Scale);
		i++;
	}
	g_InitializeTimer.Start(InitTemps,500);
}

function InitTemps()
{
	g_InitializeTimer.Stop();
	for (var i = 1; i <= g_Stat_Count;)
	{
		SystemVars.Write("CurTemp"+(padDigits(i,3)),g_Stats[i].CurrentTemp);
		SystemVars.Write("CurSetpoint"+(padDigits(i,3)),g_Stats[i].CurrentSetpoint);
		SystemVars.Write("HeatSetpoint"+(padDigits(i,3)),g_Stats[i].AutoHeatSetpoint);
		SystemVars.Write("CoolSetpoint"+(padDigits(i,3)),g_Stats[i].AutoCoolSetpoint);
		if (g_debug) 
		{
			System.Print(g_Stats[i].Name+"'s Current Temp is "+ ((g_Stats[i].CurrentTemp)/10));
			System.Print(g_Stats[i].Name+"'s Current Setpoint is "+ ((g_Stats[i].CurrentSetpoint)/10));
			System.Print(g_Stats[i].Name+"'s Auto Heat Setpoint is "+ ((g_Stats[i].AutoHeatSetpoint)/10));
			System.Print(g_Stats[i].Name+"'s Auto Cool Setpoint is "+ ((g_Stats[i].AutoCoolSetpoint)/10));
		}
		i++;
	}
	g_InitializeTimer.Start(InitOPModes,500);
}

function InitOPModes()
{
	g_InitializeTimer.Stop();
	for (var i = 1; i <= g_Stat_Count;)
	{
		OPModeChange(i, g_Stats[i].CurrentMode);
		i++;
	}
	g_InitializeTimer.Start(InitFanModes,500);
}
	
function InitFanModes()
{
	g_InitializeTimer.Stop();
	for (var i = 1; i <= g_Stat_Count;)
	{
		FanModeChange(i, g_Stats[i].CurrentFanMode);
		i++;
	}
	g_InitializeTimer.Start(InitializationFinished,500);
}

function InitializationFinished()
{
	g_InitializeTimer.Stop();
	for (var i = 1; i <= g_Stat_Count;)
	{
		InitializationChange(i,1);
		i++;
	}
}

////////////////////////////////////////////////////////////////////////////////////////////
// Internally Used JavaScript Functions ////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////
function padDigits(n, totalDigits)
{
	n = n.toString();
	var pd = "";
	if (totalDigits > n.length)
		for (var i = 0; i < (totalDigits-n.length); i++)
			pd += "0";

	return pd + n;
}

function StatObj(i)
{
	this.Name = g_Stat_Names[i];
  if (g_debug) System.Print("SDK Virtual Climate: StatObj executing for Thermostat "+i+" ("+this.Name+")");
	SystemVars.Write("Name"+(padDigits(i,3)),this.Name);
	this.Timer = new Timer();
  this.Timer.UseHandleInCallbacks = true;
	this.Timer.Cmd = "";
	g_Stat_Handle_Map[this.Timer.Handle] = i;
	this.Ctrl_Release = Stat_Ctrl_Stop;
	if (g_Temp_Scale < 1)
	{
		this.Scale = 0;
		this.CurrentTemp = 720;
		this.CurrentSetpoint = 680;
		this.AutoHeatSetpoint = 680;
		this.AutoCoolSetpoint = 740;
		this.Delta = 20;
	}
	else
	{
		this.Scale = 1;
		this.CurrentTemp = 220;		
		this.CurrentSetpoint = 200;
		this.AutoHeatSetpoint = 200;
		this.AutoCoolSetpoint = 230;
		this.Delta = 20;
	}
	switch (g_month)
	{
		case 0:	// January
		case 1:	// February
		case 2:	// March
		case 10: // November
		case 11: // December
			this.CurrentMode = 1;
			break;						
		case 3:	// April
		case 4:	// May
		case 8:	// September
		case 9:	// October
			this.CurrentMode = 3;
			break;
		case 5:	// June
		case 6:	// July
		case 7:	// August
			this.CurrentMode = 2;
			break;								
	}
	this.CurrentState = 0;
	this.CurrentFanMode = 0;
	this.CurrentFanState = 0;

	this.TempTimer = new ScheduledEvent(CurrentTempChange, "Periodic", "Minutes", 5);
	this.TempTimer.UseHandleInCallbacks = true;
	g_TempTimer_Handle_Map[this.TempTimer.Handle] = i;
}


////////////////////////////////////////////////////////////////////////////////////////////
// Variable Writing Functions //////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////
function InitializationChange(Stat, newState)
{
	if (g_debug) System.Print("SDK Virtual Climate: ///// InitializeChange("+Stat+","+newState+") /////");
	if (newState!=SystemVars.Read("InitializeState"+(padDigits(Stat,3)))) 
  {
		switch(newState)
		{
			case 0:
				if (g_debug) System.Print(g_Stats[Stat].Name+" Not Initialized");
				System.LogInfo(1,g_Stats[Stat].Name+" Not Initialized");
				System.SignalEvent("INITIALESTATE"+(padDigits(Stat,3))+"_00");
				break;
			case 1:
				if (g_debug) System.Print(g_Stats[Stat].Name+" Initialized");
				System.LogInfo(1,g_Stats[Stat].Name+" Initialized");
				System.SignalEvent("INITIALESTATE"+(padDigits(Stat,3))+"_01");
				break;
			case 2:
				if (g_debug) System.Print(g_Stats[Stat].Name+" Initializing");
				System.LogInfo(1,g_Stats[Stat].Name+" Initializing");
				System.SignalEvent("INITIALESTATE"+(padDigits(Stat,3))+"_02");
				break;
		}
		SystemVars.Write("InitializeState"+(padDigits(Stat,3)),parseInt(newState,10));
		SystemVars.Write("InitializeState"+(padDigits(Stat,3))+"_00",parseInt(newState,10)==0);
		SystemVars.Write("InitializeState"+(padDigits(Stat,3))+"_01",parseInt(newState,10)==1);
		SystemVars.Write("InitializeState"+(padDigits(Stat,3))+"_02",parseInt(newState,10)==2);
	}
}

function TempScaleChange(Stat, newState)
{
	if (g_debug) System.Print("SDK Virtual Climate: ///// TempScaleChange("+Stat+","+newState+") /////");
	if (newState!=SystemVars.Read("TempScale"+(padDigits(Stat,3)))) 
  {
		switch(newState)
		{
			case 0:
				if (g_debug) System.Print(g_Stats[Stat].Name+" is set to Fahrenheit");
				System.LogInfo(3,g_Stats[Stat].Name+" is set to Fahrenheit");
				System.SignalEvent("TEMPSCALE"+(padDigits(Stat,3))+"_00");
				break;
			case 1:
				if (g_debug) System.Print(g_Stats[Stat].Name+" is set to Celsius");
				System.LogInfo(3,g_Stats[Stat].Name+" is set to Celsius");
				System.SignalEvent("TEMPSCALE"+(padDigits(Stat,3))+"_01");
				break;
		}
		SystemVars.Write("TempScale"+(padDigits(Stat,3)),parseInt(newState,10));
		SystemVars.Write("TempScale"+(padDigits(Stat,3))+"_00",parseInt(newState,10)==0);
		SystemVars.Write("TempScale"+(padDigits(Stat,3))+"_01",parseInt(newState,10)==1);
	}
}

function OPModeChange(Stat, newState)
{
	if (g_debug) System.Print("SDK Virtual Climate: ///// OPModeChange("+Stat+","+newState+") /////");
	g_Stats[Stat].CurrentMode = newState;
	if (newState!=SystemVars.Read("OPMode"+(padDigits(Stat,3)))) 
  {
		switch(newState)
		{
			case 0:	// Off
				if (g_debug) System.Print(g_Stats[Stat].Name+" is set to Off");
				System.LogInfo(3,g_Stats[Stat].Name+" is set to Off");
				System.SignalEvent("OPMODE"+(padDigits(Stat,3))+"_00");
				OPStateChange(Stat, 0);
				break;
			case 1:	// Heat
				if (g_debug) System.Print(g_Stats[Stat].Name+" is set to Heat");
				System.LogInfo(3,g_Stats[Stat].Name+" is set to Heat");
				System.SignalEvent("OPMODE"+(padDigits(Stat,3))+"_01");		
				if (((g_Stats[Stat].CurrentTemp)) < (g_Stats[Stat].AutoHeatSetpoint))
				{
					OPStateChange(Stat, 1);
				}
				else
				{
					OPStateChange(Stat, 0);
				}
				SystemVars.Write("CurSetpoint"+(padDigits(Stat,3)),(SystemVars.Read("HeatSetpoint"+(padDigits(Stat,3)))));
				break;
			case 2:	// Cool
				if (g_debug) System.Print(g_Stats[Stat].Name+" is set to Cool");
				System.LogInfo(3,g_Stats[Stat].Name+" is set to Cool");
				System.SignalEvent("OPMODE"+(padDigits(Stat,3))+"_02");
				if (((g_Stats[Stat].CurrentTemp)) > g_Stats[Stat].AutoCoolSetpoint)
				{
					OPStateChange(Stat, 2);
				}
				else
				{
					OPStateChange(Stat, 0);
				}
				SystemVars.Write("CurSetpoint"+(padDigits(Stat,3)),(SystemVars.Read("CoolSetpoint"+(padDigits(Stat,3)))));
				break;
			case 3:	// Auto
				if (g_debug) System.Print(g_Stats[Stat].Name+" is set to Auto");
				System.LogInfo(3,g_Stats[Stat].Name+" is set to Auto");
				System.SignalEvent("OPMODE"+(padDigits(Stat,3))+"_03");
				if (g_Stats[Stat].AutoHeatSetpoint > ((g_Stats[Stat].CurrentTemp)))
				{
					OPStateChange(Stat, 1);
				}
				else if (g_Stats[Stat].AutoCoolSetpoint < ((g_Stats[Stat].CurrentTemp)))
				{
					OPStateChange(Stat, 2);
				}
				else
				{
					OPStateChange(Stat, 0);
				}
				SystemVars.Write("CurSetpoint"+(padDigits(Stat,3)),(SystemVars.Read("HeatSetpoint"+(padDigits(Stat,3)))));
				break;
		}
		SystemVars.Write("OPMode"+(padDigits(Stat,3)),parseInt(newState,10));
		for(var i = 0; i <= 3; i++)
		{
			SystemVars.Write("OPMode"+(padDigits(Stat,3))+"_"+(padDigits(i,2)),parseInt(newState,10)==i);
		}
	}
}

function OPStateChange(Stat, newState)
{
	if (g_debug) System.Print("SDK Virtual Climate: ///// OPStateChange("+Stat+","+newState+") /////");
	g_Stats[Stat].CurrentState = newState;
	if (newState!=SystemVars.Read("OPState"+(padDigits(Stat,3)))) 
  {
		switch(newState)
		{
			case 0:
				if (g_debug) System.Print(g_Stats[Stat].Name+" is in an Idle state");
				System.LogInfo(3,g_Stats[Stat].Name+" is in an Idle state");
				System.SignalEvent("OPSTATE"+(padDigits(Stat,3))+"_00");
				if(0 == g_Stats[Stat].CurrentFanMode)
				{
					FanStateChange(Stat, 0);
				}
				else
				{
					FanStateChange(Stat, 1);
				}
				break;
			case 1:
				if (g_debug) System.Print(g_Stats[Stat].Name+" is Heating");
				System.LogInfo(3,g_Stats[Stat].Name+" is Heating");
				System.SignalEvent("OPSTATE"+(padDigits(Stat,3))+"_01");
				FanStateChange(Stat, 1);
				break;
			case 2:
				if (g_debug) System.Print(g_Stats[Stat].Name+" is Cooling");
				System.LogInfo(3,g_Stats[Stat].Name+" is Cooling");
				System.SignalEvent("OPSTATE"+(padDigits(Stat,3))+"_02");
				FanStateChange(Stat, 1);
				break;
		}
		SystemVars.Write("OPState"+(padDigits(Stat,3)),parseInt(newState,10));
		for(var i = 0; i <= 2; i++)
		{
			SystemVars.Write("OPState"+(padDigits(Stat,3))+"_"+(padDigits(i,2)),parseInt(newState,10)==i);
		}
	}
}

function FanModeChange(Stat, newState)
{
	if (g_debug) System.Print("SDK Virtual Climate: ///// FanModeChange("+Stat+","+newState+") /////");
	g_Stats[Stat].CurrentFanMode = newState;
	if (newState!=SystemVars.Read("FanMode"+(padDigits(Stat,3)))) 
  {
		switch(newState)
		{
			case 0:
				if (g_debug) System.Print(g_Stats[Stat].Name+"'s fan is set to Auto");
				System.LogInfo(3,g_Stats[Stat].Name+"'s fan is set to Auto");
				System.SignalEvent("FANMODE"+(padDigits(Stat,3))+"_00");
				switch(g_Stats[Stat].CurrentState)
				{
					case 0:
						FanStateChange(Stat, 0);
						break;
					case 1:
						FanStateChange(Stat, 1);
						break;
					case 2:
						FanStateChange(Stat, 1);
						break;
				}
				break;
			case 1:
				if (g_debug) System.Print(g_Stats[Stat].Name+"'s fan is set to On");
				System.LogInfo(3,g_Stats[Stat].Name+"'s fan is set to On");
				System.SignalEvent("FANMODE"+(padDigits(Stat,3))+"_01");
				FanStateChange(Stat, 1);
				break;
		}
		SystemVars.Write("FanMode"+(padDigits(Stat,3)),parseInt(newState,10));
		SystemVars.Write("FanMode"+(padDigits(Stat,3))+"_00",parseInt(newState,10)==0);
		SystemVars.Write("FanMode"+(padDigits(Stat,3))+"_01",parseInt(newState,10)==1);
	}
}

function FanStateChange(Stat, newState)
{
	if (g_debug) System.Print("SDK Virtual Climate: ///// FanStateChange("+Stat+","+newState+") /////");
	g_Stats[Stat].CurrentFanState = newState;
	if (newState!=SystemVars.Read("FanState"+(padDigits(Stat,3)))) 
  {
		switch(newState)
		{
			case 0:
				if (g_debug) System.Print(g_Stats[Stat].Name+"'s fan is in an Off state");
				System.LogInfo(3,g_Stats[Stat].Name+"'s fan is in an Off state");
				System.SignalEvent("FANSTATE"+(padDigits(Stat,3))+"_00");
				break;
			case 1:
				if (g_debug) System.Print(g_Stats[Stat].Name+"'s fan is in an On state");
				System.LogInfo(3,g_Stats[Stat].Name+"'s fan is in an On state");
				System.SignalEvent("FANSTATE"+(padDigits(Stat,3))+"_01");
				break;
		}
		SystemVars.Write("FanState"+(padDigits(Stat,3)),parseInt(newState,10));
		SystemVars.Write("FanState"+(padDigits(Stat,3))+"_00",parseInt(newState,10)==0);
		SystemVars.Write("FanState"+(padDigits(Stat,3))+"_01",parseInt(newState,10)==1);
	}
}

////////////////////////////////////////////////////////////////////////////////////////////
// UI Executed Functions ///////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////
function SetOPMode(stat,cmd)
{
	switch(cmd)
	{
		case "Toggle":
			switch(g_Stats[stat].CurrentMode)
			{
				case 0:
					g_Stats[stat].CurrentMode = 1;
					break;
				case 1:
					g_Stats[stat].CurrentMode = 2;
					break;
				case 2:
					g_Stats[stat].CurrentMode = 3;
					break;
				case 3:
					g_Stats[stat].CurrentMode = 0;
					break;
			}
			break;
		case "Off":
			g_Stats[stat].CurrentMode = 0;
			break;
		case "Heat":
			g_Stats[stat].CurrentMode = 1;
			break;
		case "Cool":
			g_Stats[stat].CurrentMode = 2;
			break;
		case "Auto":
			g_Stats[stat].CurrentMode = 3;
			break;
	}
	OPModeChange(stat, g_Stats[stat].CurrentMode);
}

function SetFanMode(stat,cmd)
{
	switch(cmd)
	{
		case "Toggle":
			switch(g_Stats[stat].CurrentFanMode)
			{
				case 0:
					g_Stats[stat].CurrentFanMode = 1;
					break;
				case 1:
					g_Stats[stat].CurrentFanMode = 0;
					break;
			}
			break;
		case "Auto":
			g_Stats[stat].CurrentFanMode = 0;
			break;
		case "On":
			g_Stats[stat].CurrentFanMode = 1;
			break;
	}
	FanModeChange(stat, g_Stats[stat].CurrentFanMode);
}

function SetpointAdj(stat,cmd)
{
	g_Stats[(parseInt(stat,10))].Timer.Stop();
	var cur_CurrentPoint = (parseInt((SystemVars.Read("CurSetpoint"+padDigits(stat,3))),10));
	var cur_HeatPoint = (parseInt((SystemVars.Read("HeatSetpoint"+padDigits(stat,3))),10));
	var cur_CoolPoint = (parseInt((SystemVars.Read("CoolSetpoint"+padDigits(stat,3))),10));
	var cur_Delta = g_Stats[(parseInt(stat,10))].Delta;
	var cur_Scale = g_Stats[(parseInt(stat,10))].Scale;
	var adjCurrentPoint;
	var adjHeatPoint;
	var adjCoolPoint;
	switch(SystemVars.Read("OPMode"+(padDigits(stat,3))))
	{
		case 0:	// Off
			break;
		case 1:	// Heat
			g_Stats[(parseInt(stat,10))].Timer.Cmd = "CurrentSetpoint";
			switch(cmd)
			{
				case "UP":
				case "HUP":
					adjCurrentPoint = (cur_CurrentPoint+5);
					if ((adjCurrentPoint > 975) && (0 == cur_Scale))
					{
						adjCurrentPoint = 980;
					}
					else if ((adjCurrentPoint > 355) && (1 == cur_Scale))
					{
						adjCurrentPoint = 360;
					}
					adjHeatPoint = adjCurrentPoint;
					adjCoolPoint = cur_CoolPoint;
					System.LogInfo(2,"Adjusting heat level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjHeatPoint/10));
					if(adjHeatPoint >= (cur_CoolPoint-cur_Delta))
					{
						adjCoolPoint = (adjHeatPoint+cur_Delta);
						System.LogInfo(2,"Adjusting cool level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjCoolPoint/10)+" because of 2 degree delta");
					}
					break;
				case "DN":
				case "HDN":
					adjCurrentPoint = (cur_CurrentPoint-5);
					if ((adjCurrentPoint < 505) && (0 == cur_Scale))
					{
						adjCurrentPoint = 500;
					}
					else if ((adjCurrentPoint < 105) && (1 == cur_Scale))
					{
						adjCurrentPoint = 100;
					}
					adjHeatPoint = adjCurrentPoint;
					adjCoolPoint = cur_CoolPoint;
					System.LogInfo(2,"Adjusting heat level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjHeatPoint/10));
					break;
				case "CUP":
					adjCoolPoint = (cur_CoolPoint+5);
					adjHeatPoint = (cur_HeatPoint);
					adjCurrentPoint = adjHeatPoint;
					if ((adjCoolPoint > 995) && (0 == cur_Scale))
					{
						adjCoolPoint = 1000;
					}
					else if ((adjCoolPoint > 375) && (1 == cur_Scale))
					{
						adjCoolPoint = 380;
					}
					System.LogInfo(2,"Adjusting cool level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjCoolPoint/10));
					break;
				case "CDN":
					adjCoolPoint = (cur_CoolPoint-5);
					adjHeatPoint = (cur_HeatPoint);
					adjCurrentPoint = adjHeatPoint;
					if ((adjCoolPoint < 525) && (0 == cur_Scale))
					{
						adjCoolPoint = 520;
					}
					else if ((adjCoolPoint < 125) && (1 == cur_Scale))
					{
						adjCoolPoint = 120;
					}
					System.LogInfo(2,"Adjusting cool level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjCoolPoint/10));
					if(adjCoolPoint <= (cur_HeatPoint+cur_Delta))
					{
						adjHeatPoint = (adjCoolPoint-cur_Delta)
						adjCurrentPoint = adjHeatPoint;
						System.LogInfo(2,"Adjusting heat level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjHeatPoint/10)+" because of 2 degree delta");
					}
					break;
			}
			SystemVars.Write("CurSetpoint"+(padDigits(stat,3)),adjCurrentPoint);
			SystemVars.Write("HeatSetpoint"+(padDigits(stat,3)),adjHeatPoint);
			SystemVars.Write("CoolSetpoint"+(padDigits(stat,3)),adjCoolPoint);
			break;
		case 2:	// Cool
			g_Stats[(parseInt(stat,10))].Timer.Cmd = "CurrentSetpoint";
			switch(cmd)
			{
				case "UP":
				case "CUP":
					adjCurrentPoint = (cur_CurrentPoint+5);
					if ((adjCurrentPoint > 995) && (0 == cur_Scale))
					{
						adjCurrentPoint = 1000;
					}
					else if ((adjCurrentPoint > 375) && (1 == cur_Scale))
					{
						adjCurrentPoint = 380;
					}
					adjHeatPoint = cur_HeatPoint;
					adjCoolPoint = adjCurrentPoint;
					System.LogInfo(2,"Adjusting cool level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjCoolPoint/10));
					break;
				case "DN":
				case "CDN":
					adjCurrentPoint = (cur_CurrentPoint-5);
					if ((adjCurrentPoint < 525) && (0 == cur_Scale))
					{
						adjCurrentPoint = 520;
					}
					else if ((adjCurrentPoint < 125) && (1 == cur_Scale))
					{
						adjCurrentPoint = 120;
					}
					adjHeatPoint = cur_HeatPoint;
					adjCoolPoint = adjCurrentPoint;
					System.LogInfo(2,"Adjusting cool level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjCoolPoint/10));
					if(adjCoolPoint <= (cur_HeatPoint+cur_Delta))
					{
						adjHeatPoint = (adjCoolPoint-cur_Delta);
						System.LogInfo(2,"Adjusting heat level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjHeatPoint/10)+" because of 2 degree delta");
					}
					break;
				case "HUP":
					adjHeatPoint = (cur_HeatPoint+5);
					adjCoolPoint = (cur_CoolPoint);
					adjCurrentPoint = adjCoolPoint;
					if ((adjHeatPoint > 975) && (0 == cur_Scale))
					{
						adjHeatPoint = 980;
					}
					else if ((adjHeatPoint > 355) && (1 == cur_Scale))
					{
						adjHeatPoint = 360;
					}
					System.LogInfo(2,"Adjusting heat level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjHeatPoint/10));
					if(adjHeatPoint >= (cur_CoolPoint-cur_Delta))
					{
						adjCoolPoint = (adjHeatPoint+cur_Delta)
						adjCurrentPoint = adjCoolPoint;
						System.LogInfo(2,"Adjusting cool level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjCoolPoint/10)+" because of 2 degree delta");
					}
					break;
				case "HDN":
					adjHeatPoint = (cur_HeatPoint-5);
					adjCoolPoint = (cur_CoolPoint);
					adjCurrentPoint = adjCoolPoint;
					if ((adjHeatPoint < 505) && (0 == cur_Scale))
					{
						adjHeatPoint = 500;
					}
					else if ((adjHeatPoint < 105) && (1 == cur_Scale))
					{
						adjHeatPoint = 100;
					}
					System.LogInfo(2,"Adjusting heat level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjHeatPoint/10));
					break;
			}
			SystemVars.Write("CurSetpoint"+(padDigits(stat,3)),adjCurrentPoint);
			SystemVars.Write("HeatSetpoint"+(padDigits(stat,3)),adjHeatPoint);
			SystemVars.Write("CoolSetpoint"+(padDigits(stat,3)),adjCoolPoint);
			break;
		case 3:	// Auto
			g_Stats[(parseInt(stat,10))].Timer.Cmd = "AutoSetpoint";
			switch(cmd)
			{
				case "UP":
					adjHeatPoint = (cur_HeatPoint+5);
					adjCoolPoint = (cur_CoolPoint+5);
					if ((adjCoolPoint > 995) && (0 == cur_Scale))
					{
						adjCoolPoint = 1000;
						adjHeatPoint = 980;
					}
					else if ((adjCoolPoint > 375) && (1 == cur_Scale))
					{
						adjCoolPoint = 380;
						adjHeatPoint = 370;
					}
					System.LogInfo(2,"Adjusting heat level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjHeatPoint/10));
					System.LogInfo(2,"Adjusting cool level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjCoolPoint/10));
					break;
				case "DN":
					adjHeatPoint = (cur_HeatPoint-5);
					adjCoolPoint = (cur_CoolPoint-5);
					if ((adjHeatPoint < 505) && (0 == cur_Scale))
					{
						adjHeatPoint = 500;
						adjCoolPoint = 520;
					}
					else if ((adjHeatPoint < 105) && (1 == cur_Scale))
					{
						adjHeatPoint = 100;
						adjCoolPoint = 110;
					}
					System.LogInfo(2,"Adjusting heat level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjHeatPoint/10));
					System.LogInfo(2,"Adjusting cool level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjCoolPoint/10));
					break;
				case "HUP":
					adjHeatPoint = (cur_HeatPoint+5);
					adjCoolPoint = (cur_CoolPoint);
					if ((adjHeatPoint > 975) && (0 == cur_Scale))
					{
						adjHeatPoint = 980;
					}
					else if ((adjHeatPoint > 355) && (1 == cur_Scale))
					{
						adjHeatPoint = 360;
					}
					System.LogInfo(2,"Adjusting heat level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjHeatPoint/10));
					if(adjHeatPoint >= (cur_CoolPoint-cur_Delta))
					{
						adjCoolPoint = (adjHeatPoint+cur_Delta)
						System.LogInfo(2,"Adjusting cool level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjCoolPoint/10)+" because of 2 degree delta");
					}
					break;
				case "HDN":
					adjHeatPoint = (cur_HeatPoint-5);
					adjCoolPoint = (cur_CoolPoint);
					if ((adjHeatPoint < 505) && (0 == cur_Scale))
					{
						adjHeatPoint = 500;
					}
					else if ((adjHeatPoint < 105) && (1 == cur_Scale))
					{
						adjHeatPoint = 100;
					}
					System.LogInfo(2,"Adjusting heat level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjHeatPoint/10));
					adjCoolPoint = cur_CoolPoint;
					break;
				case "CUP":
					adjCoolPoint = (cur_CoolPoint+5);
					adjHeatPoint = (cur_HeatPoint);
					if ((adjCoolPoint > 995) && (0 == cur_Scale))
					{
						adjCoolPoint = 1000;
					}
					else if ((adjCoolPoint > 375) && (1 == cur_Scale))
					{
						adjCoolPoint = 380;
					}
					System.LogInfo(2,"Adjusting cool level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjCoolPoint/10));
					adjHeatPoint = cur_HeatPoint;
					break;
				case "CDN":
					adjCoolPoint = (cur_CoolPoint-5);
					adjHeatPoint = (cur_HeatPoint);
					if ((adjCoolPoint < 525) && (0 == cur_Scale))
					{
						adjCoolPoint = 520;
					}
					else if ((adjCoolPoint < 125) && (1 == cur_Scale))
					{
						adjCoolPoint = 120;
					}
					System.LogInfo(2,"Adjusting cool level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjCoolPoint/10));
					if(adjCoolPoint <= (cur_HeatPoint+cur_Delta))
					{
						adjHeatPoint = (adjCoolPoint-cur_Delta)
						System.LogInfo(2,"Adjusting heat level for "+g_Stats[(parseInt(stat,10))].Name+" to "+(adjHeatPoint/10)+" because of 2 degree delta");
					}
					break;
			}
			SystemVars.Write("HeatSetpoint"+(padDigits(stat,3)),adjHeatPoint);
			SystemVars.Write("CoolSetpoint"+(padDigits(stat,3)),adjCoolPoint);
			break;
	}
	g_Stats[(parseInt(stat,10))].Timer.Start(Stat_Ctrl_Stop,500);
}

////////////////////////////////////////////////////////////////////////////////////////////
// Timer Controlled Functions //////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////
function Stat_Ctrl_Stop(handle)
{
	// This function is used as a release mechanism for the setpoint ramping so that the Virtual Climate control is not blasted with contunuous setpoint level changes while ramping.
	// This is only an example specifically used for this driver but the concept can be used for many other devices that cannot handle continuous adjusts in a short period of time.
	// It is especially useful with thermostats and some lighting systems.
	var current_stat = g_Stat_Handle_Map[handle];
	g_Stats[current_stat].Timer.Stop();
	switch(g_Stats[current_stat].Timer.Cmd)
	{
		case "CurrentSetpoint":
			g_Stats[current_stat].CurrentSetpoint = SystemVars.Read("CurSetpoint"+(padDigits(current_stat,3)));
			g_Stats[current_stat].AutoHeatSetpoint = SystemVars.Read("HeatSetpoint"+(padDigits(current_stat,3)));
			g_Stats[current_stat].AutoCoolSetpoint = SystemVars.Read("CoolSetpoint"+(padDigits(current_stat,3)));
			System.LogInfo(3,"Current Mode setpoint level for "+g_Stats[(parseInt(current_stat,10))].Name+" is "+((g_Stats[current_stat].CurrentSetpoint)/10));
			System.LogInfo(3,"Heat Setpoint level for "+g_Stats[(parseInt(current_stat,10))].Name+" is "+((g_Stats[current_stat].AutoHeatSetpoint)/10));
			System.LogInfo(3,"Cool Setpoint level for "+g_Stats[(parseInt(current_stat,10))].Name+" is "+((g_Stats[current_stat].AutoCoolSetpoint)/10));
			break;
		case "AutoSetpoint":
			g_Stats[current_stat].AutoHeatSetpoint = SystemVars.Read("HeatSetpoint"+(padDigits(current_stat,3)));
			g_Stats[current_stat].AutoCoolSetpoint = SystemVars.Read("CoolSetpoint"+(padDigits(current_stat,3)));
			System.LogInfo(3,"Heat Setpoint level for "+g_Stats[(parseInt(current_stat,10))].Name+" is "+((g_Stats[current_stat].AutoHeatSetpoint)/10));
			System.LogInfo(3,"Cool Setpoint level for "+g_Stats[(parseInt(current_stat,10))].Name+" is "+((g_Stats[current_stat].AutoCoolSetpoint)/10));
			break;
	}
	switch(SystemVars.Read("OPMode"+(padDigits(current_stat,3))))
	{
		case 0:	// Off
			break;
		case 1:	// Heat
			if (((g_Stats[current_stat].CurrentTemp)) < (g_Stats[current_stat].AutoHeatSetpoint))
			{
				OPStateChange(current_stat, 1);
			}
			else
			{
				OPStateChange(current_stat, 0);
			}
			break;
		case 2:	// Cool
			if (((g_Stats[current_stat].CurrentTemp)) > g_Stats[current_stat].AutoCoolSetpoint)
			{
				OPStateChange(current_stat, 2);
			}
			else
			{
				OPStateChange(current_stat, 0);
			}
			break;
		case 3:	// Auto
			if (g_Stats[current_stat].AutoHeatSetpoint > ((g_Stats[current_stat].CurrentTemp)))
			{
				OPStateChange(current_stat, 1);
			}
			else if (g_Stats[current_stat].AutoCoolSetpoint < ((g_Stats[current_stat].CurrentTemp)))
			{
				OPStateChange(current_stat, 2);
			}
			else
			{
				OPStateChange(current_stat, 0);
			}
			break;
	}
}

function CurrentTempChange(handle)
{
	// This function is to emulate current temperature adjustments for day and night time when the outside weather is cool or warm.
	// It also controls the interaction of virtual climate control based on the setpoint values, current mode, and current state.
	var current_stat = g_TempTimer_Handle_Map[handle];
	var current_temp = g_Stats[current_stat].CurrentTemp;
	var current_mode = parseInt((g_Stats[current_stat].CurrentMode),10);
	var current_state = parseInt((g_Stats[current_stat].CurrentState),10);
	var heat_setpoint = g_Stats[current_stat].AutoHeatSetpoint;
	var cool_setpoint = g_Stats[current_stat].AutoCoolSetpoint;
	var g_timeShift = ((((parseInt((System.GetUTCTimeInSeconds()),10))+(g_timeDif))*1000));
	
	g_time = new Date(g_timeShift);
	g_hours = g_time.getUTCHours();
	g_month = g_time.getUTCMonth();
	if (g_debug) 
	{
		System.Print("SDK Virtual Climate: CurrentTempChange executing");
		System.Print("SDK Virtual Climate: current_stat = "+current_stat);
		System.Print("SDK Virtual Climate: current_temp = "+current_temp);
		System.Print("SDK Virtual Climate: current_mode = "+current_mode);
		System.Print("SDK Virtual Climate: current_state = "+current_state);
		System.Print("SDK Virtual Climate: heat_setpoint = "+heat_setpoint);
		System.Print("SDK Virtual Climate: cool_setpoint = "+cool_setpoint);
		System.Print("SDK Virtual Climate: g_hours = "+g_hours);
		System.Print("SDK Virtual Climate: g_month = "+g_month);
	}
	var direction = -10;

	switch (g_month)
	{
		case 0:	// January
		case 1:	// February
		case 2:	// March
		case 3:	// April
		case 9:	// October
		case 10: // November
		case 11: // December
			if((g_hours < 11) || (g_hours > 16))
			{
				direction = -20;
			}
			else
			{
				direction = -10;				
			}
			break;						
		case 4:	// May
		case 5:	// June
		case 6:	// July
		case 7:	// August
		case 8:	// September
			if((g_hours < 10) || (g_hours > 20))
			{
				direction = 20;
			}
			else
			{
				direction = 10;				
			}
			break;								
	}
	if (g_debug) System.Print("SDK Virtual Climate: direction = "+direction);
	switch(current_mode)
	{
		case 0:	// Off
			if((g_month > 3) && (g_month < 9))
			{
				// its warm outside
				if(current_temp < 1200)
				{
					current_temp += direction;
				}
			}
			else
			{
				// its cold outside
				if(current_temp > -200)
				{
					current_temp += direction;
				}
			}
			break;
		case 1:	// Heat
			if((g_month > 3) && (g_month < 9))
			{
				// its warm outside
				switch(current_state)
				{
					case 1:	// Heating
						if(current_temp < heat_setpoint)
						{
							current_temp += 20;
						}
						break;
					case 0:	// Idling
					case 2:	// Cooling
						if(current_temp < 1000)
						{
							current_temp += direction;
						}
						break;
				}
			}
			else
			{
				// its cold outside
				switch(current_state)
				{
					case 1:	// Heating
						if(current_temp < heat_setpoint)
						{
							current_temp += 20;
						}
						break;
					case 0:	// Idling
					case 2:	// Cooling
						if(current_temp > -200)
						{
							current_temp += direction;
						}
						break;
				}
			}
			break;
		case 2:	// Cool
			if((g_month > 3) && (g_month < 9))
			{
				// its warm outside
				switch(current_state)
				{
					case 2:	// Cooling
						if(current_temp > cool_setpoint)
						{
							current_temp -= 10;
						}
						break;
					case 0:	// Idling
					case 1:	// Heating
						if(current_temp > -200)
						{
							current_temp += direction;
						}
						break;
				}
			}
			else
			{
				// its cold outside
				switch(current_state)
				{
					case 2:	// Cooling
						if(current_temp > cool_setpoint)
						{
							current_temp -= 10;
						}
						break;
					case 0:	// Idling
					case 1:	// Heating
						if(current_temp > -200)
						{
							current_temp += direction;
						}
						break;
				}
			}
			break;
		case 3:	// Auto
			switch(current_state)
			{
				case 0:	// Idle
					if((g_month > 3) && (g_month < 9))
					{
						// its warm outside
						if(current_temp < 1200)
						{
							current_temp += direction;
						}
					}
					else
					{
						// its cold outside
						if(current_temp > -200)
						{
							current_temp += direction;
						}
					}
					break
				case 1: // Heating
					if(current_temp < heat_setpoint)
					{
						current_temp += 10;
					}
					break;
				case 2:	// Cooling
					if(current_temp > cool_setpoint)
					{
						current_temp -= 10;
					}
					break;
			}
			break;
	}
	g_Stats[current_stat].CurrentTemp = current_temp;
	SystemVars.Write("CurTemp"+(padDigits(current_stat,3)),g_Stats[current_stat].CurrentTemp);
	if (g_debug) System.Print(g_Stats[current_stat].Name+"'s current temperature changed to "+((g_Stats[current_stat].CurrentTemp)/10));
	System.LogInfo(3,g_Stats[current_stat].Name+"'s current temperature changed to "+((g_Stats[current_stat].CurrentTemp)/10));
	switch(current_mode)
	{	
		case 0:	// Off
			OPStateChange(current_stat, 0);
			break;
		case 1:	// Heat
			if (((g_Stats[current_stat].CurrentTemp)) < (g_Stats[current_stat].AutoHeatSetpoint))
			{
				OPStateChange(current_stat, 1);
			}
			else
			{
				OPStateChange(current_stat, 0);
			}
			SystemVars.Write("CurSetpoint"+(padDigits(current_stat,3)),(SystemVars.Read("HeatSetpoint"+(padDigits(current_stat,3)))));
			break;
		case 2:	// Cool
			if (((g_Stats[current_stat].CurrentTemp)) > g_Stats[current_stat].AutoCoolSetpoint)
			{
				OPStateChange(current_stat, 2);
			}
			else
			{
				OPStateChange(current_stat, 0);
			}
			SystemVars.Write("CurSetpoint"+(padDigits(current_stat,3)),(SystemVars.Read("CoolSetpoint"+(padDigits(current_stat,3)))));
			break;
		case 3:	// Auto
			if (g_Stats[current_stat].AutoHeatSetpoint > ((g_Stats[current_stat].CurrentTemp)))
			{
				OPStateChange(current_stat, 1);
			}
			else if (g_Stats[current_stat].AutoCoolSetpoint < ((g_Stats[current_stat].CurrentTemp)))
			{
				OPStateChange(current_stat, 2);
			}
			else
			{
				OPStateChange(current_stat, 0);
			}
			break;
	}	
}








